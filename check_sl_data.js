const pool = require('./backend/src/config/db');
async function check() {
  try {
    const [rows] = await pool.query('SELECT reference_doc_type, reference_doc_id FROM stock_ledger LIMIT 10');
    console.log('Stock Ledger Sample Data:', rows);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();
