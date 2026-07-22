const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkItem13() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: process.env.DB_NAME || 'spTech_dev',
    port: parseInt(process.env.DB_PORT || '3307')
  };

  try {
    const connection = await mysql.createConnection(config);

    const [items] = await connection.query('SELECT * FROM material_request_items WHERE mr_id = 202');
    console.log('MR 202 items:', items);

    const [sb] = await connection.query("SELECT * FROM stock_balance WHERE material_name LIKE '%MS%' OR item_code LIKE '%RM-MS%'");
    console.log('\nMatching Stock Balance for MS:', sb);

    await connection.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkItem13();
