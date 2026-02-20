const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'sales_erp'
  });
  
  try {
    const [orders] = await pool.query(
      `SELECT DISTINCT c.id, c.company_name FROM sales_orders so 
       JOIN companies c ON c.id = so.company_id 
       WHERE so.status = 'DESIGN_Approved ' AND so.current_department = 'SALES'
       ORDER BY c.id`
    );
    
    console.log(`Found ${orders.length} companies with approved orders\n`);
    
    let createdCount = 0;
    for (const company of orders) {
      const [existing] = await pool.query(
        'SELECT COUNT(*) as cnt FROM contacts WHERE company_id = ?',
        [company.id]
      );
      
      if (existing[0].cnt === 0) {
        const contactName = `${company.company_name} Manager`;
        const contactEmail = `contact@${company.company_name.toLowerCase().replace(/\s+/g, '')}.com`;
        
        await pool.query(
          'INSERT INTO contacts (company_id, name, email, phone, contact_type, status) VALUES (?, ?, ?, ?, ?, ?)',
          [company.id, contactName, contactEmail, '9000000001', 'PRIMARY', 'ACTIVE']
        );
        createdCount++;
        console.log(`✓ Created contact for company ${company.id}: ${company.company_name}`);
      }
    }
    
    console.log(`\nTotal contacts created: ${createdCount}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
})();
