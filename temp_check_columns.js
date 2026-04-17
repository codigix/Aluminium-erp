const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    const [crows] = await conn.query('DESCRIBE sales_order_item_components');
    console.log('Components Columns:', crows.map(r => r.Field));
    const [srows] = await conn.query('DESCRIBE sales_order_item_scrap');
    console.log('Scrap Columns:', srows.map(r => r.Field));
    await conn.end();
  } catch (err) {
    console.error(err);
  }
})();
