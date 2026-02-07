const mysql = require('mysql2');

async function debug() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'backend',
    database: 'sales_erp'
  }).promise();

  try {
    const [plans] = await connection.query('SELECT * FROM production_plans ORDER BY id DESC LIMIT 5');
    console.log('Last 5 Plans:', JSON.stringify(plans, null, 2));

    if (plans.length > 0) {
      const planId = plans[0].id;
      const [items] = await connection.query('SELECT * FROM production_plan_items WHERE plan_id = ?', [planId]);
      console.log(`Items for Plan ${planId}:`, JSON.stringify(items, null, 2));
      
      const [mats] = await connection.query('SELECT * FROM production_plan_materials WHERE plan_id = ?', [planId]);
      console.log(`Materials for Plan ${planId}:`, mats.length);
      
      const [ops] = await connection.query('SELECT * FROM production_plan_operations WHERE plan_id = ?', [planId]);
      console.log(`Operations for Plan ${planId}:`, ops.length);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

debug();
