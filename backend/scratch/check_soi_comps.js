const pps = require('../src/services/productionPlanService');

(async () => {
  const [soiComps] = await (require('../src/config/db')).pool.query(
    'SELECT * FROM sales_order_item_components WHERE sales_order_item_id = 100359'
  );
  console.log('soiComps count:', soiComps.length);
  const first = soiComps[0];
  console.log('soiComps[0]:', {
    code: first.component_code,
    item_group: first.item_group,
    desc: first.description
  });
  process.exit(0);
})();
