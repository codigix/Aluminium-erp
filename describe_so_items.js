const pool = require('./backend/src/config/db');
async function run() {
  const [rows] = await pool.query('DESCRIBE sales_order_items');
  console.table(rows);
  process.exit(0);
}
run();
