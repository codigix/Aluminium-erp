const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fixExistingData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    console.log('Fixing material_name in purchase_order_items...');
    
    // Fix from MR items
    await connection.query(`
      UPDATE purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.purchase_order_id
      JOIN material_request_items mri ON mri.mr_id = po.mr_id AND mri.item_code = poi.item_code
      SET poi.material_name = mri.item_name
      WHERE poi.material_name IS NULL OR poi.material_name = ''
    `);

    // Fix from Stock Balance
    await connection.query(`
      UPDATE purchase_order_items poi
      JOIN stock_balance sb ON sb.item_code = poi.item_code
      SET poi.material_name = sb.material_name
      WHERE poi.material_name IS NULL OR poi.material_name = ''
    `);

    console.log('Existing data fixed successfully!');
  } catch (error) {
    console.error('Error fixing data:', error);
  } finally {
    await connection.end();
  }
}

fixExistingData();
