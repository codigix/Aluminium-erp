const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function searchContacts() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: process.env.DB_NAME || 'spTech_prod'
  };

  const connection = await mysql.createConnection(config);

  try {
    console.log('--- Searching for Contacts ---');

    // 1. Get all customer drawings for Sidel India Pvt Ltd
    const [drawings] = await connection.query(
      `SELECT d.id, d.project_name, d.drawing_no, d.contact_person, d.phone, d.email
       FROM customer_drawings d
       WHERE d.drawing_no IN ('09000746701', '09000731403')`
    );
    console.log('Customer Drawings:', drawings);

    // 2. Get all sales order items and their sales orders for these drawings
    const [soItems] = await connection.query(
      `SELECT soi.id as soi_id, soi.drawing_no, soi.sales_order_id, so.project_name as so_project_name, so.status as so_status
       FROM sales_order_items soi
       JOIN sales_orders so ON soi.sales_order_id = so.id
       WHERE soi.drawing_no IN ('09000746701', '09000731403')`
    );
    console.log('Sales Order Items / Orders:', soItems);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

searchContacts();
