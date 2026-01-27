const mysql = require('mysql2/promise');

async function checkMissingDesignOrders() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp',
    port: 3307
  });

  try {
    console.log('--- Sales Orders with request_accepted = 1 ---');
    const [soRows] = await connection.query(`
      SELECT so.id, so.company_id, so.status, c.company_name
      FROM sales_orders so
      LEFT JOIN companies c ON so.company_id = c.id
      WHERE so.request_accepted = 1
    `);
    console.table(soRows);

    console.log('\n--- Result of listDesignOrders query ---');
    const [doRows] = await connection.query(`
      SELECT 
        do.id,
        so.id as sales_order_id,
        soi.id as item_id,
        c.company_name
      FROM design_orders do
      JOIN sales_orders so ON do.sales_order_id = so.id
      JOIN sales_order_items soi ON soi.sales_order_id = so.id
      JOIN companies c ON so.company_id = c.id
      WHERE so.request_accepted = 1
    `);
    console.log(`Total rows returned: ${doRows.length}`);
    
    const uniqueSOs = [...new Set(doRows.map(r => r.sales_order_id))];
    console.log(`Unique Sales Orders in result: ${uniqueSOs.join(', ')}`);

    const missingSOs = soRows.filter(so => !uniqueSOs.includes(so.id));
    if (missingSOs.length > 0) {
      console.log('\n--- Missing Sales Orders (In SO table but not in Query result) ---');
      console.table(missingSOs);
      
      for (const so of missingSOs) {
        console.log(`\nInvestigating SO ID: ${so.id}`);
        const [items] = await connection.query('SELECT COUNT(*) as count FROM sales_order_items WHERE sales_order_id = ?', [so.id]);
        console.log(`Items count: ${items[0].count}`);
        
        const [dos] = await connection.query('SELECT COUNT(*) as count FROM design_orders WHERE sales_order_id = ?', [so.id]);
        console.log(`Design Orders count: ${dos[0].count}`);
        
        const [comp] = await connection.query('SELECT COUNT(*) as count FROM companies WHERE id = ?', [so.company_id]);
        console.log(`Company exists: ${comp[0].count > 0}`);
      }
    } else {
      console.log('\nNo missing Sales Orders found in the query result.');
    }

  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

checkMissingDesignOrders();
