const pool = require('./src/config/db');

async function checkQuotes() {
  try {
    const [rows] = await pool.query(
      'SELECT id, quote_number, vendor_id, status, is_merged, merged_into_quotation_id FROM quotations WHERE id IN (670, 671, 674)'
    );
    console.log(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkQuotes();
