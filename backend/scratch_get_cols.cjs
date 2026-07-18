const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  });
  const [cols] = await c.query('SHOW COLUMNS FROM production_plan_materials');
  console.log('Columns:', cols.map(c => c.Field).join(', '));
  await c.end();
})();
