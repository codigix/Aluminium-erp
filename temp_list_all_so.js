const pool = require('./backend/src/config/db');
async function check() {
  try {
    const [rows] = await pool.query('SELECT id, so_number, project_name FROM sales_orders ORDER BY id DESC LIMIT 100');
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
