const pool = require('./backend/src/config/db');

async function run() {
  try {
    const [rows] = await pool.query('DESCRIBE sales_order_items');
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
