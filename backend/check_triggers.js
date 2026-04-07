const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  });
  try {
    const [triggers] = await c.query("SHOW TRIGGERS LIKE 'quotation_requests'");
    console.log('Triggers for quotation_requests:', JSON.stringify(triggers, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await c.end();
  }
}
check();
