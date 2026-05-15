const pool = require('../src/config/db');

async function run() {
  try {
    const [plans] = await pool.query('SELECT id, plan_code FROM production_plans ORDER BY id DESC LIMIT 1');
    if (plans.length === 0) {
      console.log('No plans found');
      return;
    }

    const planId = plans[0].id;
    console.log('--- Plan ---');
    console.log(plans[0]);

    const [ops] = await pool.query('SELECT id, operation_name, source_item, item_type FROM production_plan_operations WHERE plan_id = ?', [planId]);
    console.log('\n--- Operations ---');
    console.table(ops);

    const [wos] = await pool.query('SELECT id, wo_number, item_code, source_type, sales_order_item_id, bom_no, item_name, source_fg FROM work_orders WHERE plan_id = ?', [planId]);
    console.log('\n--- Work Orders ---');
    console.table(wos);

    const [soi] = await pool.query('SELECT id, item_code, drawing_no, description FROM sales_order_items WHERE id IN (?)', [wos.map(w => w.sales_order_item_id).filter(id => id)]);
    console.log('\n--- Sales Order Items ---');
    console.table(soi);

    const [jcs] = await pool.query('SELECT jc.id, jc.operation_name, jc.work_order_id, wo.wo_number FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE wo.plan_id = ?', [planId]);
    console.log('\n--- Job Cards ---');
    console.table(jcs);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
