const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp',
    port: 3307
  });
  
  try {
    const whereClause = "so.status IN ('CREATED', 'DESIGN_QUERY')";
    const query = `SELECT so.*, c.company_name, c.company_code, cp.po_number, cp.po_date, cp.currency AS po_currency, cp.net_total AS po_net_total, cp.pdf_path, 
            d.name as current_dept_name,
            soi.item_id, soi.item_code, soi.drawing_no, soi.description AS item_description, soi.quantity AS item_qty, soi.unit AS item_unit
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     LEFT JOIN departments d ON d.code = so.current_department
     LEFT JOIN (
       SELECT sales_order_id, id as item_id, item_code, drawing_no, description, quantity, unit
       FROM sales_order_items
     ) soi ON soi.sales_order_id = so.id
     WHERE (${whereClause}) AND so.request_accepted = 0
     ORDER BY so.created_at DESC`;
     
     const [rows] = await pool.query(query);
     console.log('Total rows returned:', rows.length);
     rows.forEach((r, i) => {
       console.log(`${i+1}: SO ID: ${r.id}, Company: ${r.company_name}, PO: ${r.po_number}, Item: ${r.drawing_no}, Qty: ${r.item_qty}`);
     });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
})();
