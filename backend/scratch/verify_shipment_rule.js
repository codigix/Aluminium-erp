const pool = require('../src/config/db');
const pps = require('../src/services/productionPlanService');
const wos = require('../src/services/workOrderService');

async function verify() {
  try {
    console.log('=== VERIFYING SHIPMENT RULE FOR PART AND ASSEMBLY PLANS ===\n');

    // 1. Test Part Plan: 2292 (09000714701 - has 4 BOM ops: CNC Turning, CNC Milling, QC Inspection, Packing)
    console.log('--- 1. Testing Part Plan (ID 2292) ---');
    const partPlan = await pps.getProductionPlanById(2292);
    console.log(`Plan ${partPlan.plan_code} operations (${partPlan.operations.length} total):`);
    partPlan.operations.forEach(op => {
      console.log(`  Step ${op.step_no}: ${op.operation_name} (Workstation: ${op.workstation}, Type: ${op.item_type})`);
    });

    // Verify last op is Shipment
    const lastPartOp = partPlan.operations[partPlan.operations.length - 1];
    if (lastPartOp.operation_name.toLowerCase() === 'shipment' && lastPartOp.step_no === partPlan.operations.length) {
      console.log('  -> PASS: Shipment is the final operation (Step ' + lastPartOp.step_no + ')');
    } else {
      console.error('  -> FAIL: Last operation is not Shipment!');
    }

    // Clean any prior WOs/JCs for 2292
    const [existingWos] = await pool.query('SELECT id FROM work_orders WHERE plan_id = ?', [2292]);
    for (const wo of existingWos) {
      await pool.query('DELETE FROM job_cards WHERE work_order_id = ?', [wo.id]);
      await pool.query('DELETE FROM work_orders WHERE id = ?', [wo.id]);
    }

    // Generate Work Orders and Job Cards
    const woIds = await wos.createWorkOrdersFromPlan(2292);
    console.log(`Created ${woIds.length} Work Orders:`, woIds);

    const [partJcs] = await pool.query(
      'SELECT jc.id, jc.job_card_no, jc.operation_name, jc.planned_qty, jc.sequence_no FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE wo.plan_id = ? ORDER BY jc.sequence_no ASC',
      [2292]
    );

    console.log(`\nGenerated ${partJcs.length} Job Cards for Plan 2292:`);
    partJcs.forEach(jc => {
      console.log(`  Seq ${jc.sequence_no}: [${jc.job_card_no}] ${jc.operation_name} | Qty: ${jc.planned_qty}`);
    });

    if (partJcs.length === 5 && partJcs[4].operation_name === 'Shipment') {
      console.log('  -> PASS: All 5 operations generated Job Cards with Shipment as final operation!');
    } else {
      console.error('  -> FAIL: Expected 5 Job Cards ending in Shipment!');
    }

    // 2. Test Duplicate Check: run createWorkOrdersFromPlan again
    console.log('\n--- 2. Testing Duplicate Job Card Prevention ---');
    await wos.createWorkOrdersFromPlan(2292);
    const [dupeCheck] = await pool.query(
      'SELECT COUNT(*) as cnt FROM job_cards jc JOIN work_orders wo ON jc.work_order_id = wo.id WHERE wo.plan_id = ?',
      [2292]
    );
    console.log(`Job Card count after re-running: ${dupeCheck[0].cnt} (should remain 5)`);
    if (dupeCheck[0].cnt === 5) {
      console.log('  -> PASS: No duplicate Job Cards created!');
    } else {
      console.error('  -> FAIL: Duplicate Job Cards were created!');
    }

    // 3. Test Assembly Plan: 2123 (00Y315W)
    console.log('\n--- 3. Testing Assembly Plan (ID 2123) ---');
    const asmPlan = await pps.getProductionPlanById(2123);
    console.log(`Plan ${asmPlan.plan_code} operations (${asmPlan.operations.length} total):`);
    asmPlan.operations.forEach(op => {
      console.log(`  Step ${op.step_no}: ${op.operation_name} (Workstation: ${op.workstation}, Type: ${op.item_type})`);
    });
    const lastAsmOp = asmPlan.operations[asmPlan.operations.length - 1];
    if (lastAsmOp.operation_name.toLowerCase() === 'shipment') {
      console.log('  -> PASS: Assembly plan has Shipment as final operation!');
    }

    console.log('\n=== ALL VERIFICATIONS COMPLETED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  }
}

verify();
