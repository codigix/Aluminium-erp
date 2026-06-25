1const pool = require('../src/config/db');

async function run() {
  try {
    const [project] = await pool.query(
      `SELECT id, project_name FROM sales_orders WHERE project_name = 'PRO-2026-0014'`
    );
    console.log('Project:', project);
    if (project.length === 0) {
      console.log('Project PRO-2026-0014 not found');
      process.exit(0);
    }
    const soId = project[0].id;

    const [items] = await pool.query(
      `SELECT id, parent_bom_id, item_code, drawing_no, status, bom_cost, revision_no, quantity, item_group, item_type 
       FROM sales_order_items 
       WHERE sales_order_id = ?`,
       [soId]
    );
    console.log('--- Items for Project 14 ---');
    console.table(items);

    const [components] = await pool.query(
      `SELECT id, sales_order_item_id, component_code, drawing_no, parent_id, quantity, rate, item_group 
       FROM sales_order_item_components 
       WHERE sales_order_item_id IN (SELECT id FROM sales_order_items WHERE sales_order_id = ?)`,
       [soId]
    );
    console.log('--- Components for Project 14 ---');
    console.table(components);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
