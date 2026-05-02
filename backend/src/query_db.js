const mysql = require('mysql2/promise');
async function run() {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3307,
      user: 'aluminium_user',
      password: 'C0digix$309',
      database: 'sales_erp'
    });
    
    const query = `
        SELECT jc.job_card_no, wo.item_name, wo.source_fg as raw_source_fg,
            COALESCE(soi_parent.description, oi_parent.description, soi_source.description, soi_fallback.description, oi_fallback.description, wo_parent.item_name, wo.source_fg) as source_fg_desc
        FROM job_cards jc
        JOIN work_orders wo ON jc.work_order_id = wo.id
        LEFT JOIN work_orders wo_parent ON wo.parent_wo_id = wo_parent.id
        LEFT JOIN sales_order_items soi_parent ON wo_parent.sales_order_item_id = soi_parent.id
        LEFT JOIN order_items oi_parent ON wo_parent.sales_order_item_id = oi_parent.id AND wo_parent.sales_order_id = oi_parent.order_id
        LEFT JOIN sales_order_items soi_source ON (wo.source_fg = soi_source.item_code OR wo.source_fg = soi_source.drawing_no) AND (soi_source.sales_order_id = wo.sales_order_id OR soi_source.sales_order_id IS NULL)
        LEFT JOIN sales_order_items soi_fallback ON (wo_parent.item_code = soi_fallback.item_code OR wo_parent.bom_no = soi_fallback.drawing_no) AND soi_fallback.sales_order_id IS NULL
        LEFT JOIN order_items oi_fallback ON (wo_parent.item_code = oi_fallback.item_code OR wo_parent.bom_no = oi_fallback.drawing_no) AND oi_fallback.order_id = wo_parent.sales_order_id
        WHERE jc.job_card_no = 'JC-0176-911'
    `;
    
    const [rows] = await conn.query(query);
    console.log(JSON.stringify(rows, null, 2));
    
    await conn.end();
  } catch (err) {
    console.error(err);
  }
}
run();
