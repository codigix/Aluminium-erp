// Previous rework behaviour must keep working: a rejection that was approved before rework job cards
// existed (no rework card for it) stays as extra quantity on the first operation, even after later QC
// activity on the same work order re-syncs rework quantities.
//
// Runs against spTech_dev through the test backend on port 5055 (see playwright.config.js).
// All records are created here, tagged PWTEST-..., and removed afterwards.
const { test, expect } = require('@playwright/test');
const path = require('path');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TEST_DB = process.env.TEST_DB_NAME || 'spTech_dev';
const today = new Date().toISOString().slice(0, 10);
const tag = `PWTEST-LEGACY-${Date.now()}`;
const n = v => parseFloat(v) || 0;

let db;
let token;
const ids = {};

test.beforeAll(async () => {
  expect(TEST_DB).not.toBe('spTech_prod');
  db = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: TEST_DB
  });
  const [[user]] = await db.query('SELECT id FROM users ORDER BY id LIMIT 1');
  token = jwt.sign({ id: user ? user.id : null, role: 'SYS_ADMIN', role_id: null }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '10m' });

  // Same shape as WO-00001-374: VMC (15) -> Milling (10, 1 rejected). VMC made 11, 10 inspected so far.
  const [wo] = await db.query(
    `INSERT INTO work_orders (wo_number, item_code, item_name, quantity, status, source_type)
     VALUES (?, 'PWTEST-PART', 'Playwright legacy rework part', 15, 'IN_PROGRESS', 'PART')`, [tag]
  );
  ids.wo = wo.insertId;
  const [vmc] = await db.query(
    `INSERT INTO job_cards (job_card_no, work_order_id, operation_name, sequence_no, planned_qty, produced_qty, accepted_qty,
       rejected_qty, rework_qty, status, execution_type, execution_mode, actual_start_date)
     VALUES (?, ?, 'VMC', 1, 15, 11, 10, 0, 1, 'IN_PROGRESS', 'In-House', 'In-house', ?)`, [`${tag}-V`, ids.wo, today]
  );
  ids.vmc = vmc.insertId;
  const [mill] = await db.query(
    `INSERT INTO job_cards (job_card_no, work_order_id, operation_name, sequence_no, planned_qty, produced_qty, accepted_qty,
       rejected_qty, rework_qty, status, execution_type, execution_mode, actual_start_date)
     VALUES (?, ?, 'Milling', 2, 10, 10, 9, 1, 0, 'IN_PROGRESS', 'In-House', 'In-house', ?)`, [`${tag}-M`, ids.wo, today]
  );
  ids.milling = mill.insertId;
  await db.query('INSERT INTO job_card_time_logs (job_card_id, log_date, produced_qty) VALUES (?, ?, 11), (?, ?, 10)', [ids.vmc, today, ids.milling, today]);
  // QC history approved under the previous process: no rework job card was created for the Milling rejection
  await db.query(
    `INSERT INTO job_card_quality_logs (job_card_id, check_date, inspected_qty, accepted_qty, rejected_qty, scrap_qty, status, rework_routing_type)
     VALUES (?, ?, 10, 10, 0, 0, 'APPROVED', 'SAME_OPERATION'), (?, ?, 10, 9, 1, 0, 'APPROVED', 'SAME_OPERATION')`,
    [ids.vmc, today, ids.milling, today]
  );
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
});

test('rejection without a rework card keeps its extra quantity on the first operation', async ({ request }) => {
  // New QC approval on VMC re-syncs rework quantities for the whole work order
  const res = await request.post(`/job-cards/${ids.vmc}/quality-logs`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { checkDate: today, shift: 'Day', inspectedQty: 1, acceptedQty: 1, rejectedQty: 0, scrapQty: 0, status: 'APPROVED' }
  });
  expect(res.status(), await res.text()).toBeLessThan(300);

  const [cards] = await db.query('SELECT * FROM job_cards WHERE work_order_id = ? ORDER BY id', [ids.wo]);
  const vmc = cards.find(c => c.id === ids.vmc);
  const milling = cards.find(c => c.id === ids.milling);

  // VMC keeps the extra piece to rework: target 15 + 1 = 16, as in the previous process
  expect(n(vmc.rework_qty)).toBe(1);
  expect(n(vmc.accepted_qty)).toBe(11);
  // Milling's own rejection record is untouched; no new rework card was invented for old history
  expect([n(milling.accepted_qty), n(milling.rejected_qty), n(milling.rework_qty)]).toEqual([9, 1, 0]);
  expect(cards.filter(c => c.is_rework)).toHaveLength(0);
});
