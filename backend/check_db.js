const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function check() {
  try {
    const config = {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3307,
      user: process.env.DB_USER || 'aluminium_user',
      password: process.env.DB_PASSWORD || 'C0digix$309',
      database: process.env.DB_NAME || 'sales_erp'
    };
    const db = await mysql.createConnection(config);
    const [rows] = await db.query('SELECT * FROM job_card_inward_item_rates');
    console.log(JSON.stringify(rows, null, 2));
    await db.end();
  } catch (error) {
    console.error(error);
  }
}
check();
