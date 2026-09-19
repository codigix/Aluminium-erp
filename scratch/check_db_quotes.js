const pool = require('../backend/src/config/db');

async function check() {
  const [rows] = await pool.query('SELECT id, quote_number, status, is_merged, merged_into_quotation_id, created_at FROM quotations ORDER BY id DESC LIMIT 15');
  console.log('Last 15 quotations:');
  console.table(rows);

  const [rfqRows] = await pool.query('SELECT id, rfq_number, status, is_merged, merged_into_rfq_id FROM procurement_rfqs ORDER BY id DESC LIMIT 10');
  console.log('Last 10 RFQs:');
  console.table(rfqRows);

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
