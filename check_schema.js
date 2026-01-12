const pool = require('./backend/src/config/db');
async function run() {
  try {
    await pool.query('ALTER TABLE sales_order_items ADD COLUMN drawing_pdf VARCHAR(500) AFTER revision_no');
    console.log('Column drawing_pdf added successfully');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
