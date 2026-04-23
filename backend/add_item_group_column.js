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
    const [columns] = await conn.query('SHOW COLUMNS FROM quotation_requests LIKE "item_group"');
    if (columns.length === 0) {
      await conn.query('ALTER TABLE quotation_requests ADD COLUMN item_group VARCHAR(50) NULL AFTER item_unit');
      console.log('Added item_group column to quotation_requests');
    } else {
      console.log('item_group column already exists');
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await conn.end();
  }
})();
