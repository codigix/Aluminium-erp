const pool = require('./backend/src/config/db');
async function check() {
  try {
    const [statuses] = await pool.query('SELECT DISTINCT status FROM sales_orders');
    console.log('Sales Order Statuses:', statuses);
    const [depts] = await pool.query('SELECT * FROM departments');
    console.log('Departments:', depts);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
