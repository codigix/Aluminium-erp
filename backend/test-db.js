const mysql = require('mysql2');
require('dotenv').config({ path: '.env' });

async function test() {
  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sales_erp'
    };
    console.log('Connecting with config:', { ...config, password: '***' });
    const connection = await mysql.createConnection(config).promise();
    const [vendors] = await connection.query('SELECT id, vendor_name, status FROM vendors');
    console.log('Vendors found:', vendors.length);
    console.log('Vendor sample:', vendors.slice(0, 5));
    
    const [items] = await connection.query('SELECT COUNT(*) as count FROM stock_balance');
    console.log('Stock items count:', items[0].count);

    await connection.end();
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

test();
