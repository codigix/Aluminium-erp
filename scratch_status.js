const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function check() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3307', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spTech_prod'
  });

  const [quotes] = await pool.query(
    'SELECT id, quote_number, vendor_id, status, is_merged, merged_into_quotation_id, project_name, total_amount, created_at FROM quotations ORDER BY id DESC LIMIT 15'
  );
  console.log('Recent quotations:');
  console.table(quotes);

  const [rfqs] = await pool.query(
    'SELECT id, rfq_number, status, is_merged, merged_into_rfq_id, vendor_id, created_at FROM procurement_rfqs ORDER BY id DESC LIMIT 5'
  );
  console.log('Recent RFQs:');
  console.table(rfqs);

  await pool.end();
}
check().catch(console.error);
