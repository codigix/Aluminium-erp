const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkPO4Items() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    const [rows] = await connection.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = 4');
    console.log('PO 4 Items:');
    console.table(rows.map(r => ({
        id: r.id,
        item_code: r.item_code,
        material_name: r.material_name,
        description: r.description
    })));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkPO4Items();
