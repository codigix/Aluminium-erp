const pool = require('../src/config/db');
const workOrderService = require('../src/services/workOrderService');
const pps = require('../src/services/productionPlanService');

async function test() {
  try {
    // Find a plan with multiple operations (e.g. 2287 or 2292)
    const planId = 2287;
    console.log(`Testing Work Order & Job Card creation for plan ${planId}...`);
    
    // Check plan ops
    const plan = await pps.getProductionPlanById(planId);
    console.log(`Plan ${plan.plan_code} has ${plan.operations.length} operations:`, plan.operations.map(o => o.operation_name));
    
    // Delete any existing WOs / JCs for this test plan first so we can test cleanly
    const [existingWos] = await pool.query('SELECT id FROM work_orders WHERE plan_id = ?', [planId]);
    for (const wo of existingWos) {
      await pool.query('DELETE FROM job_cards WHERE work_order_id = ?', [wo.id]);
      await pool.query('DELETE FROM work_orders WHERE id = ?', [wo.id]);
    }

    // Call createWorkOrdersFromPlan
    const woIds = await workOrderService.createWorkOrdersFromPlan(planId);
    console.log('Created work orders:', woIds);

    // Query resulting Job Cards
    for (const woId of woIds) {
      const [wos] = await pool.query('SELECT wo_number, item_code, item_name, quantity, source_type FROM work_orders WHERE id = ?', [woId]);
      const [jcs] = await pool.query('SELECT id, job_card_no, operation_name, planned_qty, sequence_no, execution_type FROM job_cards WHERE work_order_id = ? ORDER BY sequence_no ASC', [woId]);
      console.log(`\nWO: ${wos[0].wo_number} (${wos[0].item_code}) Qty: ${wos[0].quantity} Type: ${wos[0].source_type}`);
      console.log(`Generated ${jcs.length} Job Cards:`);
      jcs.forEach(jc => {
        console.log(`  Seq ${jc.sequence_no}: [${jc.job_card_no}] ${jc.operation_name} | Qty: ${jc.planned_qty} | Exec: ${jc.execution_type}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

test();
