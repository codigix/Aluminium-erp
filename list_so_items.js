const db = require('./backend/src/config/db');
async function run() {
  const [rows] = await db.query('SELECT id, item_code, drawing_no FROM sales_order_items ORDER BY id DESC LIMIT 5');
  console.log(rows);
  process.exit(0);
}
run();
