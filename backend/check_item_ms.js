const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkItemMS() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: process.env.DB_NAME || 'spTech_dev',
    port: parseInt(process.env.DB_PORT || '3307')
  };

  try {
    const connection = await mysql.createConnection(config);

    const [items] = await connection.query('SELECT * FROM material_request_items WHERE mr_id = 202 AND item_code = "RM-MS-0001"');
    console.log('MRI Item:', items[0]);

    const [sb] = await connection.query('SELECT item_code, material_name, current_balance FROM stock_balance WHERE item_code = "RAW-MS-0001" OR material_name = "MS"');
    console.log('Stock balance:', sb);

    await connection.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkItemMS();
