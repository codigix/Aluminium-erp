const pool = require('../src/config/db');

async function testQuery() {
  try {
    const [rows] = await pool.query(
      `SELECT wo.id, wo.wo_number, wo.item_code, wo.item_name, wo.bom_no, wo.source_type,
              COALESCE(
                CASE WHEN cd.drawing_type IS NOT NULL AND cd.drawing_type != '' THEN cd.drawing_type END,
                CASE WHEN soi.item_group IS NOT NULL AND soi.item_group != '' THEN soi.item_group END,
                CASE WHEN soic.item_group IS NOT NULL AND soic.item_group != '' THEN soic.item_group END,
                CASE WHEN sb.material_type IS NOT NULL AND sb.material_type != '' THEN sb.material_type END,
                soi_item.item_group,
                ''
              ) as item_group,
              COALESCE(
                CASE WHEN cd.drawing_type IS NOT NULL AND cd.drawing_type != '' THEN cd.drawing_type END,
                CASE WHEN soi.drawing_type IS NOT NULL AND soi.drawing_type != '' THEN soi.drawing_type END,
                CASE WHEN soic.item_group IS NOT NULL AND soic.item_group != '' THEN soic.item_group END,
                CASE WHEN sb.material_type IS NOT NULL AND sb.material_type != '' THEN sb.material_type END,
                soi_item.drawing_type,
                ''
              ) as drawing_type
       FROM work_orders wo
       LEFT JOIN sales_order_items soi ON wo.sales_order_item_id = soi.id
       LEFT JOIN sales_order_items soi_item ON (soi.id IS NULL AND wo.item_code = soi_item.item_code)
       LEFT JOIN stock_balance sb ON wo.item_code = sb.item_code
       LEFT JOIN (
         SELECT component_code, MAX(item_group) as item_group 
         FROM sales_order_item_components 
         GROUP BY component_code
       ) soic ON wo.item_code = soic.component_code
       LEFT JOIN customer_drawings cd ON wo.item_code = cd.drawing_no
       WHERE wo.plan_id = 2123 OR wo.item_code LIKE '%00Y315W%' OR wo.item_name LIKE '%ASSEMBLAGE%'
       ORDER BY wo.id ASC`
    );

    console.log('Work Orders with classifications:');
    rows.forEach(r => {
      console.log(`WO: ${r.wo_number} | Code: ${r.item_code} | Name: ${r.item_name.substring(0, 30)} | source_type: ${r.source_type} | item_group: ${r.item_group} | drawing_type: ${r.drawing_type}`);
    });
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

testQuery();
