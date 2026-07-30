const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function check() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3307,
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: process.env.DB_NAME || 'spTech_dev'
  };

  const connection = await mysql.createConnection(config);
  try {
    const [cd] = await connection.query("SELECT id, drawing_no, status FROM customer_drawings WHERE drawing_no = 'DRW-1002'");
    console.log('Customer Drawings (customer_drawings):', cd);

    const [sb] = await connection.query("SELECT id, drawing_no FROM stock_balance WHERE drawing_no = 'DRW-1002'");
    console.log('Stock Balance (stock_balance):', sb);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}
check();
