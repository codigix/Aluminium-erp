const pool = require('./backend/src/config/db');
async function run() {
  try {
    const [soi] = await pool.query('SELECT * FROM sales_order_items WHERE item_code = "9000011033" OR drawing_no = "9000011033" OR description LIKE "%Cooling Rail Support%"');
    console.log('Sales Order Items:', JSON.stringify(soi, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
