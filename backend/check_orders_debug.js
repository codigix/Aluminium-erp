const pool = require('./src/config/db');

async function check() {
  try {
    const [salesOrders] = await pool.query('SELECT id, company_id, project_name FROM sales_orders');
    console.log('Sales Orders:', salesOrders);

    const [orders] = await pool.query('SELECT id, order_no, quotation_id, client_id FROM orders');
    console.log('Orders:', orders);

    const [readyOrders] = await pool.query(`
      SELECT so.id, 
            o.order_no, 
            so.project_name, 
            c.company_name
     FROM sales_orders so
     LEFT JOIN companies c ON so.company_id = c.id
     JOIN orders o ON o.quotation_id = so.id
    `);
    console.log('Ready Orders query result:', readyOrders);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
