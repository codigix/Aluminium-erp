const mysql = require('mysql2/promise');

async function checkApprovedDrawings() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp',
    port: 3307
  });

  try {
    console.log('--- Approved Drawings ---');
    const [rows] = await connection.query(`
      SELECT 
        so.id as so_id, 
        c.company_name, 
        soi.drawing_no, 
        soi.status,
        do.id as design_order_id,
        so.request_accepted
      FROM sales_orders so 
      JOIN companies c ON so.company_id = c.id 
      JOIN sales_order_items soi ON soi.sales_order_id = so.id 
      LEFT JOIN design_orders do ON do.sales_order_id = so.id
      WHERE soi.status = 'Approved '
    `);
    console.table(rows);

    console.log('\n--- Design Orders ---');
    const [doRows] = await connection.query('SELECT * FROM design_orders');
    console.table(doRows);

    console.log('\n--- Sales Orders ---');
    const [soRows] = await connection.query('SELECT id, company_id, request_accepted FROM sales_orders');
    console.table(soRows);

    console.log('\n--- Sales Order Items ---');
    const [soiRows] = await connection.query('SELECT id, sales_order_id, drawing_no, status FROM sales_order_items');
    console.table(soiRows);

  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

checkApprovedDrawings();
