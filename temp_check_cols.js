const pool = require('./backend/src/config/db');
async function run() {
  try {
    const tables = ['production_plan_materials', 'production_plan_sub_assemblies', 'production_plan_items', 'sales_order_item_materials', 'sales_order_item_components'];
    for (const table of tables) {
      const [cols] = await pool.query(`SHOW COLUMNS FROM ${table}`);
      console.log(`${table}:`, cols.map(c => c.Field));
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
