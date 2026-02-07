const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'sales_erp'
  });
  
  try {
    const [counts] = await pool.query(
      `SELECT status, current_department, COUNT(*) as cnt FROM sales_orders 
       GROUP BY status, current_department`
    );
    
    console.log('Sales Orders by Status and Department:');
    console.log(JSON.stringify(counts, null, 2));
    
    const [designApproved] = await pool.query(
      `SELECT COUNT(*) as cnt FROM sales_orders 
       WHERE status = 'DESIGN_APPROVED' AND current_department = 'SALES'`
    );
    
    console.log('\nDesign Approved + Sales:', designApproved[0].cnt);
    
    const [companies] = await pool.query(
      `SELECT DISTINCT company_id FROM sales_orders 
       WHERE status = 'DESIGN_APPROVED' AND current_department = 'SALES'`
    );
    
    console.log('\nCompanies with approved orders:', companies.length);
    console.log(JSON.stringify(companies, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
})();
