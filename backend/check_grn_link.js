const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // Test the actual query used in getAllStockEntries for recent entries
    console.log('=== Stock entries with drawing_no (recent) ===');
    const [rows] = await conn.query(`
      SELECT se.id, se.entry_no, se.grn_id,
             COALESCE(
               (SELECT pp_inner.bom_no 
                FROM grns g_inner
                JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number
                JOIN material_requests mr_inner ON po_inner.mr_id = mr_inner.id
                JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id 
                WHERE g_inner.id = se.grn_id 
                LIMIT 1),
               (SELECT soi_inner.drawing_no 
                FROM grns g_inner
                JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number
                JOIN sales_order_items soi_inner ON po_inner.sales_order_id = soi_inner.sales_order_id
                WHERE g_inner.id = se.grn_id 
                LIMIT 1)
             ) as drawing_no,
             COALESCE(
               (SELECT ppi_inner.description 
                FROM grns g_inner
                JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number
                JOIN material_requests mr_inner ON po_inner.mr_id = mr_inner.id
                JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id 
                JOIN production_plan_items ppi_inner ON pp_inner.id = ppi_inner.plan_id 
                WHERE g_inner.id = se.grn_id 
                LIMIT 1),
               (SELECT soi_inner.description 
                FROM grns g_inner
                JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number
                JOIN sales_order_items soi_inner ON po_inner.sales_order_id = soi_inner.sales_order_id
                WHERE g_inner.id = se.grn_id 
                LIMIT 1)
             ) as finished_good
      FROM stock_entries se
      ORDER BY se.id DESC
      LIMIT 10
    `);
    rows.forEach(r => console.log(r));
  } finally {
    await conn.end();
  }
})();
