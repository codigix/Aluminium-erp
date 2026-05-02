const pool = require('./backend/src/config/db');

async function checkProjectNames() {
  try {
    const [salesOrders] = await pool.query('SELECT DISTINCT project_name FROM sales_orders');
    console.log('Project Names in sales_orders:');
    salesOrders.forEach(so => console.log(`- ${so.project_name}`));

    // Check other tables
    const tablesToCheck = ['quotations', 'purchase_orders', 'customer_pos', 'quotation_requests'];
    for (const table of tablesToCheck) {
        try {
            const [results] = await pool.query(`SELECT DISTINCT project_name FROM ${table}`);
            console.log(`\nProject Names in ${table}:`);
            results.forEach(res => console.log(`- ${res.project_name}`));
        } catch (e) {
            console.log(`\n${table} table might not have project_name column or table doesn't exist.`);
        }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

checkProjectNames();
