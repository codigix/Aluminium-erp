const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'sales_erp'
  });
  
  try {
    const [rows] = await pool.query('SELECT company_id, COUNT(*) as cnt FROM contacts GROUP BY company_id');
    console.log('Total contacts per company:');
    console.log(JSON.stringify(rows, null, 2));
    
    const [check12] = await pool.query('SELECT id, name, email, phone, contact_type FROM contacts WHERE company_id = 12');
    console.log('\nContacts for company 12:');
    console.log(JSON.stringify(check12, null, 2));
    
    if (check12.length === 0) {
      console.log('\nNo contacts found for company 12. Creating sample contact...');
      const [result] = await pool.query(
        'INSERT INTO contacts (company_id, name, email, phone, contact_type, status) VALUES (?, ?, ?, ?, ?, ?)',
        [12, 'John Doe', 'john@example.com', '9876543210', 'PRIMARY', 'ACTIVE']
      );
      console.log('Created contact:', result.insertId);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
})();
