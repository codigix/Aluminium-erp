const pool = require('./backend/src/config/db');
async function check() {
  try {
    const [rows] = await pool.query('SELECT id, status, request_accepted, customer_po_id, project_name FROM sales_orders WHERE project_name LIKE "%nitin%" OR company_id IN (SELECT id FROM companies WHERE company_name LIKE "%nitin%")');
    console.log('Orders related to "nitin":');
    console.log(JSON.stringify(rows, null, 2));
    
    const [counts] = await pool.query('SELECT status, COUNT(*) as count FROM sales_orders GROUP BY status');
    console.log('\nStatus counts:');
    console.log(JSON.stringify(counts, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
