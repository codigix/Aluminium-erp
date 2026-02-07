const pool = require('./backend/src/config/db');

async function clean() {
  const tables = [
    'qc_inspections',
    'grn_items',
    'grns',
    'po_receipt_items',
    'po_receipts',
    'purchase_order_items',
    'purchase_orders',
    'quotation_items',
    'quotations',
    'quotation_requests',
    'design_rejections',
    'design_orders',
    'sales_order_item_materials',
    'sales_order_item_components',
    'sales_order_item_operations',
    'sales_order_item_scrap',
    'sales_order_items',
    'sales_orders',
    'customer_po_items',
    'customer_pos',
    'stock_ledger',
    'customer_drawings'
  ];

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    console.log('Checking tables for data:');
    for (const table of tables) {
      const [rows] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = rows[0].count;
      console.log(`${table}: ${count} rows`);
      if (count > 0) {
        console.log(`Cleaning ${table}...`);
        await connection.query(`DELETE FROM ${table}`);
        await connection.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\nFinal Verification:');
    for (const table of tables) {
      const [rows] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`${table}: ${rows[0].count} rows`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Clean failed:', err);
    if (connection) await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }
}

clean();
