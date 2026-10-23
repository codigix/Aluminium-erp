// Business rule: when VMC (operation 2) rejects a piece, QC approval creates ONE rework job card
// on Welding (the first operation) for the rejected quantity. No VMC rework card is created and no
// other operation is repeated. Original production, QC history and accepted quantities stay intact.
//
// Runs against the spTech_dev database through a dedicated backend on port 5055 (see
// playwright.config.js). Every record is created by this test, tagged PWTEST-..., and removed afterwards.
const { test, expect } = require('@playwright/test');
const path = require('path');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TEST_DB = process.env.TEST_DB_NAME || 'spTech_dev';
const PROD_DB = 'spTech_prod';
const today = new Date().toISOString().slice(0, 10);
const tag = `PWTEST-${Date.now()}`;

const dbConfig = (database) => ({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database
});

let db;
let prodDb;
let token;
let prodJobCardCount;
const ids = { wo: null, welding: null, vmc: null, shipment: null, weldingQc: null };

const jobCardsOfWo = async () => {
  const [rows] = await db.query('SELECT * FROM job_cards WHERE work_order_id = ? ORDER BY id', [ids.wo]);
  return rows;
};
const n = v => parseFloat(v) || 0;

test.beforeAll(async () => {
  expect(TEST_DB, 'tests must never run against the production database').not.toBe(PROD_DB);
  db = await mysql.createConnection(dbConfig(TEST_DB));
  prodDb = await mysql.createConnection(dbConfig(PROD_DB));

  const [[{ c }]] = await prodDb.query('SELECT COUNT(id) AS c FROM job_cards');
  prodJobCardCount = Number(c);

  const [[user]] = await db.query('SELECT id FROM users ORDER BY id LIMIT 1');
  token = jwt.sign({ id: user ? user.id : null, role: 'SYS_ADMIN', role_id: null }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '10m' });

  // Isolated part work order: Welding -> VMC -> Shipment, quantity 1
  const [wo] = await db.query(
    `INSERT INTO work_orders (wo_number, item_code, item_name, quantity, status, source_type)
     VALUES (?, 'PWTEST-PART', 'Playwright rework test part', 1, 'IN_PROGRESS', 'PART')`,
    [tag]
  );
  ids.wo = wo.insertId;

  const insertJc = async (suffix, op, seq, fields) => {
    const [r] = await db.query(
      `INSERT INTO job_cards (job_card_no, work_order_id, operation_name, sequence_no, planned_qty, produced_qty,
         accepted_qty, rejected_qty, transferred_qty, status, execution_type, execution_mode, actual_start_date, setup_time)
       VALUES (?, ?, ?, ?, 1, ?, ?, 0, ?, ?, 'In-House', 'In-house', ?, ?)`,
      [`${tag}-${suffix}`, ids.wo, op, seq, fields.produced, fields.accepted, fields.transferred, fields.status, fields.started ? today : null, fields.setup]
    );
    return r.insertId;
  };
  ids.welding = await insertJc('W', 'WELDING', 1, { produced: 1, accepted: 1, transferred: 1, status: 'IN_PROGRESS', started: true, setup: 5 });
  ids.vmc = await insertJc('V', 'VMC', 2, { produced: 1, accepted: 0, transferred: 0, status: 'IN_PROGRESS', started: true, setup: 10 });
  ids.shipment = await insertJc('S', 'Shipment', 3, { produced: 0, accepted: 0, transferred: 0, status: 'PENDING', started: false, setup: 0 });

  // Production already recorded: 1 piece made at Welding (QC accepted) and 1 at VMC
  await db.query('INSERT INTO job_card_time_logs (job_card_id, log_date, produced_qty) VALUES (?, ?, 1), (?, ?, 1)', [ids.welding, today, ids.vmc, today]);
  const [qc] = await db.query(
    `INSERT INTO job_card_quality_logs (job_card_id, check_date, inspected_qty, accepted_qty, rejected_qty, scrap_qty, status, rework_routing_type)
     VALUES (?, ?, 1, 1, 0, 0, 'APPROVED', 'SAME_OPERATION')`,
    [ids.welding, today]
  );
  ids.weldingQc = qc.insertId;
});

test.afterAll(async () => {
  if (db && ids.wo) {
    const [cards] = await db.query('SELECT id FROM job_cards WHERE work_order_id = ?', [ids.wo]);
    const cardIds = cards.map(c => c.id);
    if (cardIds.length) {
      await db.query('DELETE FROM job_card_quality_logs WHERE job_card_id IN (?)', [cardIds]);
      await db.query('DELETE FROM job_card_time_logs WHERE job_card_id IN (?)', [cardIds]);
      await db.query("DELETE FROM production_audit_log WHERE entity_type IN ('JOB_CARD', 'QUALITY_LOG') AND entity_id IN (?)", [cardIds]);
      await db.query('DELETE FROM job_cards WHERE id IN (?)', [cardIds]);
    }
    await db.query('DELETE FROM work_orders WHERE id = ?', [ids.wo]);
  }
  if (db) await db.end();
  if (prodDb) await prodDb.end();
});

test('VMC rejection creates one Welding rework job card only', async ({ request }) => {
  const before = await jobCardsOfWo();
  expect(before).toHaveLength(3);

  // QC rejects the VMC piece (no routing chosen -> business-rule default applies)
  const res = await request.post(`/job-cards/${ids.vmc}/quality-logs`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      checkDate: today, shift: 'Day', inspectedQty: 1, acceptedQty: 0, rejectedQty: 1, scrapQty: 0,
      rejectionReason: 'PWTEST dimension out of tolerance', status: 'APPROVED'
    }
  });
  expect(res.status(), await res.text()).toBeLessThan(300);

  const after = await jobCardsOfWo();
  const rework = after.filter(jc => jc.is_rework);
  const originals = after.filter(jc => !jc.is_rework);

  // 1. Exactly one rework job card, on Welding, for the rejected quantity, linked to the VMC card
  expect(rework).toHaveLength(1);
  const rw = rework[0];
  expect(rw.rework_of_job_card_id).toBe(ids.vmc);
  expect(rw.sequence_no).toBe(1);
  expect(rw.operation_name).toMatch(/^Rework: WELDING/);
  expect(n(rw.planned_qty)).toBe(1);
  expect(rw.status).toBe('PENDING');
  expect(n(rw.setup_time)).toBe(5); // Welding's setup time, saved in the right column
  expect(rw.remarks).toContain(`${tag}-V`);

  // 2. No VMC rework card and no other operation repeated
  expect(rework.some(jc => /VMC/i.test(jc.operation_name) && !/for VMC/i.test(jc.operation_name))).toBe(false);
  expect(after).toHaveLength(4);

  // 3. Original production, acceptance and rejection records preserved
  const welding = originals.find(jc => jc.id === ids.welding);
  const vmc = originals.find(jc => jc.id === ids.vmc);
  const shipment = originals.find(jc => jc.id === ids.shipment);
  expect([n(welding.planned_qty), n(welding.produced_qty), n(welding.accepted_qty)]).toEqual([1, 1, 1]);
  expect([n(vmc.planned_qty), n(vmc.produced_qty), n(vmc.accepted_qty), n(vmc.rejected_qty)]).toEqual([1, 1, 0, 1]);
  expect([n(shipment.produced_qty), shipment.status]).toEqual([0, 'PENDING']);

  const [logs] = await db.query('SELECT * FROM job_card_quality_logs WHERE job_card_id IN (?, ?) ORDER BY id', [ids.welding, ids.vmc]);
  expect(logs).toHaveLength(2);
  expect(logs[0].id).toBe(ids.weldingQc);
  const vmcLog = logs.find(l => l.job_card_id === ids.vmc);
  expect([vmcLog.status, n(vmcLog.rejected_qty), vmcLog.rework_routing_type]).toEqual(['APPROVED', 1, 'FIRST_OPERATION']);
  const [timeLogs] = await db.query('SELECT job_card_id, produced_qty FROM job_card_time_logs WHERE job_card_id IN (?, ?)', [ids.welding, ids.vmc]);
  expect(timeLogs).toHaveLength(2);

  // 4. Rework tracked separately (no double counting): Welding keeps its own quantities,
  //    the reworked piece is carried by the rework card, VMC only gets room to process it again
  expect(n(welding.rework_qty)).toBe(0);
  expect(n(vmc.rework_qty)).toBe(1);
  expect(n(shipment.rework_qty)).toBe(0);
});

test('re-saving the same QC entry does not create a second rework card', async ({ request }) => {
  const [[vmcLog]] = await db.query('SELECT id FROM job_card_quality_logs WHERE job_card_id = ? ORDER BY id DESC LIMIT 1', [ids.vmc]);
  const res = await request.put(`/job-cards/quality-logs/${vmcLog.id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { inspectedQty: 1, acceptedQty: 0, rejectedQty: 1, scrapQty: 0, status: 'APPROVED' }
  });
  expect(res.status(), await res.text()).toBeLessThan(300);

  const rework = (await jobCardsOfWo()).filter(jc => jc.is_rework);
  expect(rework).toHaveLength(1);
  expect(rework[0].rework_of_job_card_id).toBe(ids.vmc);
  expect(n(rework[0].planned_qty)).toBe(1);
});

test('production database was not touched', async () => {
  const [[{ c }]] = await prodDb.query('SELECT COUNT(id) AS c FROM job_cards');
  expect(Number(c)).toBe(prodJobCardCount);
});
