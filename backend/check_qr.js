const pool = require('./src/config/db');
async function run() {
  try {
    const [rows] = await pool.query("SELECT id, batch_id, item_code, drawing_no, description, item_group, bom_cost, status FROM quotation_requests WHERE drawing_no = '04261098201'");
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
run();
