const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'backend',
  database: 'sales_erp'
});
async function run() {
  try {
    const [rows] = await pool.query('SELECT id, sales_order_id FROM quotation_requests WHERE sales_order_item_id IS NULL');
    console.log(`Found ${rows.length} quotation requests with NULL item id`);
    
    for (const qr of rows) {
      const [items] = await pool.query('SELECT id FROM sales_order_items WHERE sales_order_id = ?', [qr.sales_order_id]);
      if (items.length > 0) {
        console.log(`Fixing QR ${qr.id} with item ${items[0].id}`);
        await pool.execute('UPDATE quotation_requests SET sales_order_item_id = ? WHERE id = ?', [items[0].id, qr.id]);
        
        // If there are more items, create new quotation requests for them
        for (let i = 1; i < items.length; i++) {
          console.log(`Creating new QR for sales order ${qr.sales_order_id} item ${items[i].id}`);
          await pool.execute(
            'INSERT INTO quotation_requests (sales_order_id, sales_order_item_id, company_id, status, created_at) SELECT sales_order_id, ?, company_id, status, created_at FROM quotation_requests WHERE id = ?',
            [items[i].id, qr.id]
          );
        }
      }
    }
    console.log('Migration completed');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
