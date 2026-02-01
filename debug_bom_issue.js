const pool = require('./backend/src/config/db');

async function debug() {
  try {
    const [orders] = await pool.query("SELECT so.id, so.project_name, c.company_name FROM sales_orders so JOIN companies c ON so.company_id = c.id WHERE so.project_name LIKE '%PLan%' OR c.company_name LIKE '%PLan%'");
    console.log('Orders found:', orders);

    if (orders.length > 0) {
      for (const order of orders) {
        console.log(`\n--- Items for Order ID: ${order.id} (${order.project_name}) ---`);
        const [items] = await pool.query("SELECT id, item_code, drawing_no, description, quantity FROM sales_order_items WHERE sales_order_id = ?", [order.id]);
        for (const item of items) {
          const [mats] = await pool.query("SELECT count(*) as count FROM sales_order_item_materials WHERE sales_order_item_id = ?", [item.id]);
          const [comps] = await pool.query("SELECT count(*) as count FROM sales_order_item_components WHERE sales_order_item_id = ?", [item.id]);
          const [ops] = await pool.query("SELECT count(*) as count FROM sales_order_item_operations WHERE sales_order_item_id = ?", [item.id]);
          
          console.log(`Item ID: ${item.id}, Code: ${item.item_code}, Dwg: ${item.drawing_no}, Qty: ${item.quantity}, Materials: ${mats[0].count}, Components: ${comps[0].count}, Operations: ${ops[0].count}`);
        }

        console.log(`\n--- Master BOMs for these drawings ---`);
        const dwgs = [...new Set(items.map(i => i.drawing_no))];
        for (const dwg of dwgs) {
           const [mats] = await pool.query("SELECT count(*) as count FROM sales_order_item_materials WHERE drawing_no = ? AND sales_order_item_id IS NULL", [dwg]);
           console.log(`Drawing: ${dwg}, Master Materials: ${mats[0].count}`);
        }
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debug();
