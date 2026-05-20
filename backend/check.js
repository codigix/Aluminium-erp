const pool = require('./src/config/db');
async function run() {
  try {
    const [rows] = await pool.query("SELECT id, description, sales_order_item_id, item_code, drawing_no, item_group FROM quotation_requests WHERE drawing_no = '12344444'");
    console.log(rows);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
run();
