const pool = require('./backend/src/config/db');
async function run() {
  try {
    const poId = 15; // PO-2026-0002 (the old one)
    const [items] = await pool.query(
      `SELECT 
        poi.id,
        poi.item_code,
        COALESCE(
          (SELECT MAX(bom_cost) FROM sales_order_items soi WHERE (soi.item_code = poi.item_code OR soi.drawing_no = poi.item_code) AND soi.bom_cost > 0),
          (SELECT MAX(rate) FROM sales_order_item_materials som WHERE (som.item_code = poi.item_code OR som.drawing_no = poi.item_code) AND som.rate > 0),
          (SELECT MAX(rate) FROM sales_order_item_components soc WHERE (soc.component_code = poi.item_code OR soc.drawing_no = poi.item_code) AND soc.rate > 0),
          poi.unit_rate
        ) as calculated_unit_rate
       FROM purchase_order_items poi
       WHERE poi.purchase_order_id = ?`,
      [poId]
    );
    console.log('Items with calculated rates:', JSON.stringify(items, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
