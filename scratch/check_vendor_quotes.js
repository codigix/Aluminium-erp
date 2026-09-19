const pool = require('../backend/src/config/db');

async function check() {
  const [rows] = await pool.query(`
    SELECT id, quote_number, status, is_merged, merged_into_quotation_id, vendor_id, grand_total
    FROM quotations
    WHERE vendor_id = 70
    ORDER BY id DESC
  `);
  console.log('Quotations for vendor 70 (RK LASER UNIT 2):');
  console.table(rows);
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
