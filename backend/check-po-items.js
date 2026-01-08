const pool = require('./src/config/db');

async function checkItems() {
  try {
    const [poItems] = await pool.query(`
      SELECT id, item_code, description, quantity 
      FROM purchase_order_items 
      WHERE purchase_order_id = (SELECT id FROM purchase_orders WHERE po_number = 'IPPSR25200356')
    `);

    const [cpItems] = await pool.query(`
      SELECT cpi.id, cpi.item_code, cpi.description, cpi.quantity
      FROM customer_po_items cpi
      WHERE customer_po_id = (
        SELECT customer_po_id FROM sales_orders 
        WHERE id = (SELECT sales_order_id FROM purchase_orders WHERE po_number = 'IPPSR25200356')
      )
    `);

    console.log('\n=== PURCHASE_ORDER_ITEMS ===');
    console.log(`Count: ${poItems.length}`);
    poItems.forEach(item => {
      console.log(`- ${item.item_code}: ${item.description} (qty: ${item.quantity})`);
    });

    console.log('\n=== CUSTOMER_PO_ITEMS ===');
    console.log(`Count: ${cpItems.length}`);
    cpItems.forEach(item => {
      console.log(`- ${item.item_code}: ${item.description} (qty: ${item.quantity})`);
    });

    console.log('\n=== MATCH ANALYSIS ===');
    cpItems.forEach(cpItem => {
      const match = poItems.find(poi => poi.item_code === cpItem.item_code);
      if (match) {
        console.log(`✓ ${cpItem.item_code} - FOUND in PO items`);
      } else {
        console.log(`✗ ${cpItem.item_code} - MISSING from PO items`);
      }
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkItems();
