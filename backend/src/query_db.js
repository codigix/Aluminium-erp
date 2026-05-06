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
        SELECT 'RFQ' as type, rfq_number as ref, created_at FROM procurement_rfqs ORDER BY created_at DESC LIMIT 5
        UNION ALL
        SELECT 'PO' as type, po_number as ref, created_at FROM purchase_orders ORDER BY created_at DESC LIMIT 5
        UNION ALL
        SELECT 'GRN' as type, po_number as ref, created_at FROM grns ORDER BY created_at DESC LIMIT 5
    `;
    
    const [rows] = await conn.query(query);
    console.log(JSON.stringify(rows, null, 2));
    
    await conn.end();
  } catch (err) {
    console.error(err);
  }
}
run();
