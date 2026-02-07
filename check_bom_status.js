const pool = require('./backend/src/config/db'); 
async function test() { 
  try { 
    // Wait for bootstrap to likely finish
    console.log('Waiting for potential bootstrap...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const [rows] = await pool.query('SELECT id, customer_po_id FROM sales_orders WHERE id = 1');
    console.log('Order 1 info:', JSON.stringify(rows[0]));

    process.exit(0); 
  } catch (e) { 
    console.error(e); 
    process.exit(1); 
  } 
} 
test();