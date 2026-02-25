const pool = require('./backend/src/config/db');
async function setup() {
  try {
    // 1. Create a company if none exists
    let [companies] = await pool.query('SELECT id FROM companies LIMIT 1');
    let companyId;
    if (companies.length === 0) {
      const [res] = await pool.execute("INSERT INTO companies (company_name, company_code) VALUES ('Test Company', 'TC001')");
      companyId = res.insertId;
    } else {
      companyId = companies[0].id;
    }

    // 2. Create a sales order in PRODUCTION_COMPLETED status
    const [soRes] = await pool.execute(
      `INSERT INTO sales_orders (company_id, project_name, status, current_department, production_priority, target_dispatch_date)
       VALUES (?, 'Test Project', 'PRODUCTION_COMPLETED', 'QUALITY', 'NORMAL', CURDATE())`,
      [companyId]
    );
    const soId = soRes.insertId;
    console.log('Created Sales Order:', soId);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
setup();
