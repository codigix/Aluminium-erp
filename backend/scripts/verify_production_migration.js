// READ-ONLY check that the production migrations from the redesign have been applied.
// Run after starting the backend once:   node scripts/verify_production_migration.js
// The session is set READ ONLY, so MySQL itself rejects any write. It never loads src/config/db.js
// (loading that file is what runs the schema bootstrap).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mysql = require('mysql2/promise');

const EXPECTED_COLUMNS = {
  job_cards: ['is_rework', 'rework_of_job_card_id', 'held_by_job_card_id', 'held_at', 'hold_reason', 'status_before_hold'],
  job_card_quality_logs: ['created_by', 'approved_by', 'approved_at'],
  material_issues: ['stock_source']
};
const EXPECTED_TABLES = ['work_order_dependencies', 'production_audit_log', 'work_order_material_returns'];
const COUNT_TABLES = ['work_orders', 'job_cards', 'job_card_time_logs', 'job_card_quality_logs', 'material_issues', 'material_requests', 'production_plans', 'stock_ledger', 'stock_balance', 'shipment_orders'];

(async () => {
  const db = process.env.DB_NAME;
  const conn = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: db });
  await conn.query('SET SESSION TRANSACTION READ ONLY');
  let problems = 0;
  const check = (ok, text) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`); if (!ok) problems += 1; };

  console.log(`Database: ${db}\n`);
  for (const [table, columns] of Object.entries(EXPECTED_COLUMNS)) {
    const [rows] = await conn.query('SELECT column_name AS c FROM information_schema.columns WHERE table_schema = ? AND table_name = ?', [db, table]);
    const have = new Set(rows.map(r => r.c));
    columns.forEach(c => check(have.has(c), `${table}.${c}`));
  }
  const [tables] = await conn.query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?', [db]);
  const haveTables = new Set(tables.map(r => r.t));
  EXPECTED_TABLES.forEach(t => check(haveTables.has(t), `table ${t}`));

  const [[status]] = await conn.query("SELECT COLUMN_TYPE AS t FROM information_schema.columns WHERE table_schema = ? AND table_name = 'job_cards' AND column_name = 'status'", [db]);
  check(/ON_HOLD/.test(status.t) && /CANCELLED/.test(status.t), `job_cards.status allows ON_HOLD and CANCELLED (${status.t})`);

  if (haveTables.has('work_order_dependencies')) {
    const [[d]] = await conn.query('SELECT COUNT(*) AS n FROM work_order_dependencies');
    const [[p]] = await conn.query('SELECT COUNT(*) AS n FROM work_orders WHERE parent_wo_id IS NOT NULL');
    check(Number(d.n) >= Number(p.n), `dependencies backfilled: ${d.n} rows for ${p.n} work orders that have a parent`);
  }

  console.log('\nRow counts (compare with before the migration; they should not have dropped):');
  for (const t of COUNT_TABLES) {
    try { const [[r]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``); console.log(`  ${t}: ${r.n}`); } catch (e) { console.log(`  ${t}: n/a`); }
  }
  await conn.end();
  console.log(problems === 0 ? '\nAll migration checks passed.' : `\n${problems} check(s) failed — paste this output to me.`);
  process.exit(problems === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
