const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function query() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp',
    port: process.env.DB_PORT || 3306
  };

  const connection = await mysql.createConnection(config);

  try {
    const [orders] = await connection.query(`
      SELECT id, status, quotation_id FROM sales_orders
    `);
    console.log('Orders:', orders);

    const [items] = await connection.query(`
      SELECT id, sales_order_id, item_code, item_type, item_group, bom_id, bom_cost, status, drawing_no, description
      FROM sales_order_items
    `);
    console.log('All Items:', JSON.stringify(items, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

query();
