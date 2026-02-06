require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'sales_erp',
    port: Number(process.env.DB_PORT || 3306)
  });
  
  try {
    const [rows] = await pool.query(
      `SELECT so.id, so.company_id, c.company_name, c.company_code, c.id as company_id_check,
       IFNULL(ct.email, '') as email,
       IFNULL(ct.phone, '') as phone,
       IFNULL(ct.name, '') as contact_person
       FROM sales_orders so
       LEFT JOIN companies c ON c.id = so.company_id
       LEFT JOIN (
         SELECT company_id, email, phone, name, 
                ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
         FROM contacts
       ) ct ON ct.company_id = c.id AND ct.rn = 1
       WHERE so.status = 'DESIGN_APPROVED' AND so.current_department = 'SALES'
       LIMIT 5`
    );
    
    console.log('Query results:');
    console.log(JSON.stringify(rows, null, 2));
    
    if (rows.length > 0) {
      console.log('\nFirst order contact info:');
      console.log('  email:', rows[0].email);
      console.log('  phone:', rows[0].phone);
      console.log('  contact_person:', rows[0].contact_person);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
})();
