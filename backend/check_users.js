const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3307,
      user: 'aluminium_user',
      password: 'C0digix$309',
      database: 'sales_erp'
    });
    console.log(`Connected to sales_erp on port 3307`);
    const [rows] = await connection.query('SELECT item_code, material_name, material_type FROM stock_balance');
    console.log(rows);
    await connection.end();
  } catch (err) {
    console.log(`Failed. Error:`, err);
  }
}

testConnection();
