const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3307
  });
  try {
    const [columns] = await conn.query('SHOW COLUMNS FROM quotation_requests');
    console.log(JSON.stringify(columns, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await conn.end();
  }
})();
