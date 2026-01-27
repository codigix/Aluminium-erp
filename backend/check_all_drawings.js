const mysql = require('mysql2/promise');

async function checkAllDrawings() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp',
    port: 3307
  });

  try {
    console.log('--- All Sales Order Items with Drawings ---');
    const [rows] = await connection.query(`
      SELECT 
        soi.id as item_id, 
        soi.drawing_no, 
        soi.status as item_status,
        so.id as so_id, 
        so.status as so_status,
        c.company_name,
        do.id as design_order_id
      FROM sales_order_items soi
      JOIN sales_orders so ON soi.sales_order_id = so.id
      JOIN companies c ON so.company_id = c.id
      LEFT JOIN design_orders do ON do.sales_order_id = so.id
      WHERE soi.drawing_no IS NOT NULL AND soi.drawing_no != ''
    `);
    console.table(rows);

    const missingDesignOrder = rows.filter(r => !r.design_order_id);
    if (missingDesignOrder.length > 0) {
      console.log('\n--- Items with Drawings but NO Design Order ---');
      console.table(missingDesignOrder);
    } else {
      console.log('\nAll items with drawings have a Design Order.');
    }

    const rejectedItems = rows.filter(r => r.item_status === 'REJECTED');
    if (rejectedItems.length > 0) {
      console.log('\n--- Items with Drawings but REJECTED status ---');
      console.table(rejectedItems);
    }

  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

checkAllDrawings();
