const productionPlanService = require('./backend/src/services/productionPlanService');
const pool = require('./backend/src/config/db');

async function test() {
  try {
    // Check first available plan
    const [plans] = await pool.query('SELECT id, plan_code FROM production_plans ORDER BY id DESC LIMIT 1');
    if (plans.length === 0) {
      console.log('No production plans found');
      process.exit(0);
    }
    
    const planId = plans[0].id;
    const planCode = plans[0].plan_code;
    console.log(`Testing with Plan ID: ${planId}, Code: ${planCode}`);

    const result = await productionPlanService.getMaterialRequestItemsForPlan(planId);
    console.log('\nMaterial Request Items Analysis:');
    result.items.forEach(item => {
      console.log(`- Item: ${item.material_name} (${item.item_code})`);
      console.log(`  Required: ${item.quantity}`);
      console.log(`  Inventory (Current + Issued): ${item.inventory}`);
      console.log(`  Shortage: ${Math.max(0, item.quantity - item.inventory)}`);
      console.log(`  Status: ${item.inventory >= item.quantity ? 'IN STOCK' : 'SHORTAGE'}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
