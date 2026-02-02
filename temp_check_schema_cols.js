const pool = require('./backend/src/config/db');
async function check() {
  try {
    const [rows] = await pool.query('DESCRIBE sales_order_item_components');
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
