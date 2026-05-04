const pool = require('./backend/src/config/db');

async function check() {
  try {
    const [wos] = await pool.query('SELECT * FROM work_orders WHERE sales_order_id = 37');
    console.log('Work Orders for SO 37:', JSON.stringify(wos, null, 2));
    
    const [jc] = await pool.query('SELECT * FROM job_cards WHERE work_order_id IN (SELECT id FROM work_orders WHERE sales_order_id = 37)');
    console.log('Job Cards for SO 37:', JSON.stringify(jc, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
