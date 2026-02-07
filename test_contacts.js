const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'aluminium_erp'
  });
  
  const [rows] = await pool.query('SELECT company_id, COUNT(*) as cnt FROM contacts GROUP BY company_id LIMIT 10');
  console.log('Contacts by company:');
  console.log(JSON.stringify(rows, null, 2));
  
  const [check12] = await pool.query('SELECT id, name, email, phone, contact_type FROM contacts WHERE company_id = 12');
  console.log('\nContacts for company_id 12:');
  console.log(JSON.stringify(check12, null, 2));
  
  process.exit(0);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
