const mysql = require('mysql2/promise');

async function debugBOMCreationData() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp',
    port: 3307
  });

  try {
    console.log('=== 1. All Sales Orders ===');
    const [salesOrders] = await connection.query(`
      SELECT so.id, so.status, so.current_department, so.request_accepted, c.company_name, cp.po_number
      FROM sales_orders so
      JOIN companies c ON so.company_id = c.id
      LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
    `);
    console.table(salesOrders);

    console.log('\n=== 2. All Design Orders ===');
    const [designOrders] = await connection.query(`
      SELECT do.id, do.sales_order_id, do.status, do.design_order_number
      FROM design_orders do
    `);
    console.table(designOrders);

    console.log('\n=== 3. Sales Order Items Status Distribution ===');
    const [itemStats] = await connection.query(`
      SELECT status, COUNT(*) as count
      FROM sales_order_items
      GROUP BY status
    `);
    console.table(itemStats);

    console.log('\n=== 4. Check for Sales Orders without Design Orders (but accepted) ===');
    const orphans = salesOrders.filter(so => 
      so.request_accepted === 1 && !designOrders.some(do_ => do_.sales_order_id === so.id)
    );
    console.table(orphans);

    console.log('\n=== 5. Sample Items for each Sales Order ===');
    for (const so of salesOrders) {
      const [items] = await connection.query(`
        SELECT id, drawing_no, item_code, status 
        FROM sales_order_items 
        WHERE sales_order_id = ? 
        LIMIT 5
      `, [so.id]);
      console.log(`SO ID: ${so.id} (${so.company_name})`);
      console.table(items);
    }

  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

debugBOMCreationData();
