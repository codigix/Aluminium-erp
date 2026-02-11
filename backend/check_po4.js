const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkPO4() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    const [po] = await connection.query('SELECT * FROM purchase_orders WHERE id = 4');
    console.log('PO 4:');
    console.table(po);
    
    if (po[0].mr_id) {
       const [mrItems] = await connection.query('SELECT * FROM material_request_items WHERE mr_id = ?', [po[0].mr_id]);
       console.log('MR Items for PO 4:');
       console.table(mrItems);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkPO4();
