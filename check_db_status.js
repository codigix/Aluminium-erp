const pool = require('./backend/src/config/db');
async function check() {
  try {
    const [wos] = await pool.query('SELECT id, wo_number, item_name, source_type FROM work_orders ORDER BY id DESC LIMIT 10');
    console.log('Work Orders:', JSON.stringify(wos, null, 2));
    
    const [woDetails] = await pool.query('SELECT * FROM work_orders WHERE id = 8');
    console.log('WO 8 Details:', JSON.stringify(woDetails, null, 2));

    const [planOps] = await pool.query('SELECT * FROM production_plan_operations WHERE plan_id = (SELECT plan_id FROM work_orders WHERE id = 8)');
    console.log('Production Plan Operations:', JSON.stringify(planOps, null, 2));

    const [soiDetails] = await pool.query('SELECT id, item_code, drawing_no FROM sales_order_items WHERE id IN (1, 3)');
    console.log('SOI 1 & 3 Details:', JSON.stringify(soiDetails, null, 2));

    const [allOps] = await pool.query('SELECT * FROM operations');
    console.log('Master Operations:', JSON.stringify(allOps, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
