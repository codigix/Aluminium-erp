const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function checkStock() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: process.env.DB_NAME || 'sales_erp'
  };

  const connection = await mysql.createConnection(config);
  try {
    const [rows] = await connection.query('SELECT id, item_code, item_description, material_name, material_type, unit, valuation_rate, selling_rate, drawing_no, drawing_id FROM stock_balance LIMIT 20');
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}
checkStock();
