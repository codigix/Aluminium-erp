const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function debugItems() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  };

  const connection = await mysql.createConnection(config);

  try {
    console.log('Fetching Sales Orders...');
    const [orders] = await connection.query('SELECT id, project_name FROM sales_orders WHERE project_name LIKE "%Client Requirement%" OR project_name LIKE "%Industrial Shaft%"');
    console.table(orders);

    if (orders.length > 0) {
        for (const order of orders) {
            console.log(`\nItems for Order ID ${order.id} (${order.project_name}):`);
            const [items] = await connection.query('SELECT id, drawing_no, description, item_group, item_type, status, bom_cost, design_qty FROM sales_order_items WHERE sales_order_id = ?', [order.id]);
            console.table(items);
        }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

debugItems();
