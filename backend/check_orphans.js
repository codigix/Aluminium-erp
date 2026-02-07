const mysql = require('mysql2/promise');

async function checkOrphanedOrders() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp',
    port: 3307
  });

  try {
    console.log('--- Sales Orders Status and Design Orders ---');
    const [rows] = await connection.query(`
      SELECT 
        so.id as so_id, 
        so.status, 
        so.current_department, 
        so.request_accepted,
        do.id as design_order_id
      FROM sales_orders so
      LEFT JOIN design_orders do ON do.sales_order_id = so.id
    `);
    console.table(rows);

    console.log('\n--- Sales Orders with status DESIGN_APPROVED but no Design Order ---');
    const filtered = rows.filter(r => r.status === 'DESIGN_APPROVED' && !r.design_order_id);
    console.table(filtered);

  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

checkOrphanedOrders();
