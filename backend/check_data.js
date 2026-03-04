const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp',
    port: process.env.DB_PORT || 3306
  });

  try {
    const [pos] = await connection.execute("SELECT id, po_number, status FROM purchase_orders ORDER BY created_at DESC LIMIT 5");
    console.log('Recent Purchase Orders:', JSON.stringify(pos, null, 2));

    if (pos.length > 0) {
      const poId = pos[0].id;
      const [items] = await connection.execute("SELECT id, item_code, quantity, accepted_quantity, amount, total_amount FROM purchase_order_items WHERE purchase_order_id = ?", [poId]);
      console.log(`Items for PO ID ${poId}:`, JSON.stringify(items, null, 2));
    }
  } catch (error) {
    console.error('Failed to check data:', error);
  } finally {
    await connection.end();
  }
}

checkData();
