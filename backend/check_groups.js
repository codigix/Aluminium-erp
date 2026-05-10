const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: process.env.DB_NAME || 'sales_erp',
    port: process.env.DB_PORT || 3307
  });

  try {
    const [rows] = await connection.query(`
      SELECT id, status, item_group, drawing_no, version, batch_id 
      FROM quotation_requests 
      WHERE status IN ('SENT', 'REVISED', 'DRAFT', 'APPROVED')
      ORDER BY created_at DESC
    `);
    console.log('Quotation Request Details:');
    console.log(rows);

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

check();
