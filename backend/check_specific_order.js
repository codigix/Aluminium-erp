const mysql = require('mysql2/promise');

async function checkSpecificOrder() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'backend',
    database: 'sales_erp',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    // Find the Sales Order ID for ORD-20260203-001
    // It might be in the orders table or sales_orders
    const [orders] = await pool.query("SELECT quotation_id, order_no FROM orders WHERE order_no = 'ORD-20260203-001'");
    
    let soId;
    if (orders.length > 0) {
      soId = orders[0].quotation_id;
      console.log(`Found Order ORD-20260203-001 linked to Sales Order ID: ${soId}`);
    } else {
      console.log("Could not find ORD-20260203-001 in orders table. Searching by project name...");
      const [so] = await pool.query("SELECT id, project_name FROM sales_orders WHERE project_name LIKE '%Design Review%' ORDER BY created_at DESC LIMIT 1");
      if (so.length === 0) {
        console.log("No matching sales order found at all.");
        return;
      }
      soId = so[0].id;
      console.log(`Found Sales Order: ${so[0].project_name} (ID: ${soId})`);
    }

    console.log("\n--- sales_order_items for this SO ---");
    const [items] = await pool.query("SELECT id, item_code, item_type, drawing_no, status, description, quantity FROM sales_order_items WHERE sales_order_id = ?", [soId]);
    console.table(items);

    // Also check if any item is marked as SFG or something else
    const [allTypes] = await pool.query("SELECT DISTINCT item_type FROM sales_order_items WHERE sales_order_id = ?", [soId]);
    console.log("\nDistinct item types in this SO:", allTypes.map(t => t.item_type));

  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkSpecificOrder();
