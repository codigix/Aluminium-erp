const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  });
  try {
    const [cols] = await c.query('DESCRIBE quotation_requests');
    console.log('Schema on port ' + (process.env.DB_PORT || 3307) + ':');
    cols.forEach(col => {
      if (col.Field === 'sales_order_id') {
        console.log(JSON.stringify(col, null, 2));
      }
    });
  } catch (e) {
    console.error(e);
  } finally {
    await c.end();
  }
}
check();
