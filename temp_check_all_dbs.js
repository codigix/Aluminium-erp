const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function checkDb(dbName) {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: dbName
  };
  try {
    const conn = await mysql.createConnection(config);
    const [rows] = await conn.query('SELECT COUNT(*) as count FROM sales_orders').catch(() => [[{count: 'N/A'}]]);
    console.log(`Database ${dbName}: ${rows[0].count} sales orders`);
    if (rows[0].count > 0 && rows[0].count !== 'N/A') {
        const [samples] = await conn.query('SELECT id, project_name FROM sales_orders LIMIT 3');
        console.log('Samples:', samples);
    }
    await conn.end();
  } catch (err) {
    console.log(`Database ${dbName}: Error connecting (${err.message})`);
  }
}

async function run() {
  await checkDb('spTech_dev');
  await checkDb('spTech_prod');
  await checkDb('sales_erp');
  process.exit(0);
}
run();
