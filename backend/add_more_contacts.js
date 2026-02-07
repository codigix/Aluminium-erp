const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'sales_erp'
  });
  
  try {
    const [existing] = await pool.query(
      'SELECT * FROM contacts WHERE company_id = 12'
    );
    
    console.log('Existing contacts for company 12:');
    console.log(JSON.stringify(existing, null, 2));
    
    if (existing.length > 0) {
      console.log('\nContacts already exist for company 12. Database should now display email/phone!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
})();
