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
    const status = 'SENT,DRAFT,REVISED,Revised,Approved,Accepted,REJECTED,Completed';
    const statusArray = status.split(',').map(s => s.trim());
    const query = `
      SELECT qr.*, c.company_name 
      FROM quotation_requests qr
      JOIN companies c ON c.id = qr.company_id
      WHERE TRIM(qr.status) IN (${statusArray.map(() => '?').join(',')})
      ORDER BY qr.created_at DESC
    `;
    const [rows] = await connection.query(query, statusArray);
    console.log(`Found ${rows.length} rows matching the query.`);
    console.log(rows.slice(0, 5).map(r => ({ id: r.id, status: r.status, batch_id: r.batch_id })));

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

check();
