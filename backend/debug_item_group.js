const mysql = require('mysql2');
require('dotenv').config({ path: './.env' });

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3307
  }).promise();
  try {
    const [columns] = await conn.query('SHOW COLUMNS FROM quotation_requests LIKE "item_group"');
    console.log('Columns matching "item_group":', columns);
    
    const [allColumns] = await conn.query('SHOW COLUMNS FROM quotation_requests');
    console.log('All columns:', allColumns.map(c => c.Field));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await conn.end();
  }
})();
