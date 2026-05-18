const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function inspectData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    const [salesOrders] = await connection.query(`
      SELECT id, client_name, project_name, contact_person, contact_phone, email_address 
      FROM sales_orders
    `);
    console.log('--- Sales Orders ---');
    console.log(JSON.stringify(salesOrders, null, 2));

    const [drawings] = await connection.query(`
      SELECT id, client_name, project_name, contact_person, phone, email, sales_order_id, drawing_no
      FROM customer_drawings
    `);
    console.log('--- Customer Drawings ---');
    console.log(JSON.stringify(drawings, null, 2));

    const [items] = await connection.query(`
      SELECT id, sales_order_id, drawing_id, drawing_no, contact_person, phone, email
      FROM sales_order_items
    `);
    console.log('--- Sales Order Items ---');
    console.log(JSON.stringify(items, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

inspectData();
