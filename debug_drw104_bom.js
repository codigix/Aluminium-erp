const pool = require('./backend/src/config/db');

async function debug() {
  try {
    const drawingNo = 'DRW_104';
    console.log(`Checking BOM for Drawing: ${drawingNo}`);

    const [materials] = await pool.query('SELECT * FROM sales_order_item_materials WHERE drawing_no = ? AND sales_order_item_id IS NULL', [drawingNo]);
    console.log('\n--- Materials ---');
    console.table(materials.map(m => ({ name: m.material_name, parent_id: m.parent_id, bom_no: m.bom_no })));

    const [components] = await pool.query('SELECT * FROM sales_order_item_components WHERE drawing_no = ? AND sales_order_item_id IS NULL', [drawingNo]);
    console.log('\n--- Components ---');
    console.table(components.map(c => ({ code: c.component_code, parent_id: c.parent_id, bom_no: c.bom_no, drawing_no: c.drawing_no })));

    const [items] = await pool.query('SELECT * FROM sales_order_items WHERE drawing_no = ?', [drawingNo]);
     console.log('\n--- Sales Order Items for DRW_104 ---');
     console.table(items.map(i => ({ id: i.id, item_code: i.item_code, drawing_no: i.drawing_no, bom_cost: i.bom_cost, so_id: i.sales_order_id })));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
debug();
