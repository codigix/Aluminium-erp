const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME
  });

  const [subs] = await pool.query('SELECT item_code, description, design_qty, required_qty, target_warehouse, bom_no FROM production_plan_sub_assemblies WHERE plan_id = 1513');
  console.log('Sub-assemblies in plan 1513 count:', subs.length);
  console.log('First 5:', subs.slice(0, 5));

  process.exit(0);
})();
