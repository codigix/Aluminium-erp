const pool = require('./backend/src/config/db');
async function check() {
  try {
    const [rows] = await pool.query('SELECT id, order_no, project_name FROM orders ORDER BY id DESC LIMIT 20');
    console.log('Orders table:');
    console.table(rows);
    
    const [counts] = await pool.query('SELECT COUNT(*) as count FROM sales_orders');
    console.log('Total Sales Orders:', counts[0].count);
    
    const [so_sample] = await pool.query('SELECT id, so_number, project_name FROM sales_orders LIMIT 10');
    console.log('Sales Orders sample:');
    console.table(so_sample);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
