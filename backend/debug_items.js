const mysql = require('mysql2/promise');

async function checkData() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'backend',
    database: 'sales_erp'
  });

  try {
    const [orders] = await connection.query('SELECT id, project_name FROM sales_orders ORDER BY id DESC LIMIT 5');
    console.log('--- Recent Sales Orders ---');
    console.table(orders);

    const latestId = 20;
    const [items] = await connection.query('SELECT id, item_code, item_type, drawing_no, quantity, status FROM sales_order_items WHERE sales_order_id = ?', [latestId]);
    console.log(`\n--- Items for Sales Order ID: ${latestId} ---`);
    console.table(items);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkData();
