const pool = require('../src/config/db');

async function check() {
  try {
    const itemCode = 'SA-ALUMINUMAS-0001';
    const drawingNo = '9000011064';

    const [soItems] = await pool.query(`
      SELECT id, sales_order_id, status, created_at 
      FROM sales_order_items 
      WHERE (item_code = ? OR drawing_no = ?)
      ORDER BY id DESC
    `, [itemCode, drawingNo]);
    
    console.log('Matching SO Items:');
    console.table(soItems);

    for (const item of soItems) {
        const [m] = await pool.query('SELECT material_name, qty_per_pc FROM sales_order_item_materials WHERE sales_order_item_id = ?', [item.id]);
        console.log(`\nMaterials for ID ${item.id} (SO: ${item.sales_order_id}, Status: ${item.status}):`);
        console.table(m);
    }

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
