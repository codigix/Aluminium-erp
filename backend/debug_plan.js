const pool = require('./src/config/db');

async function debugPlan() {
  try {
    const [materials] = await pool.query("SELECT id, sales_order_item_id, item_code, material_name, parent_id FROM sales_order_item_materials WHERE item_code LIKE 'SA-%'");
    console.log('\n--- SA Materials ---');
    console.table(materials);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debugPlan();
