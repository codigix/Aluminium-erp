const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  });
  try {
    // 1. Disable FK checks
    await c.query('SET FOREIGN_KEY_CHECKS = 0');
    // 2. Modify column
    await c.query('ALTER TABLE quotation_requests MODIFY COLUMN sales_order_id INT NULL');
    // 3. Enable FK checks
    await c.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Successfully modified sales_order_id to be nullable on port ' + (process.env.DB_PORT || 3307));
  } catch (e) {
    console.error(e);
  } finally {
    await c.end();
  }
}
run();
