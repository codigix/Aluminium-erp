const pool = require('./backend/src/config/db');

async function fixNumericItemCodes() {
  console.log('Starting data migration for numeric item codes...');
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1. Get all numeric items
    const [items] = await connection.query(
      "SELECT id, item_code, material_name FROM stock_balance WHERE item_code REGEXP '^[0-9]+$'"
    );
    
    console.log(`Found ${items.length} items to fix.`);
    
    for (const item of items) {
      if (!item.material_name) continue;
      
      const cleanName = item.material_name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toUpperCase();
      const newCode = `${cleanName}-${item.id}`;
      
      console.log(`Updating ${item.item_code} -> ${newCode}`);
      
      // Update stock_balance
      await connection.execute(
        'UPDATE stock_balance SET item_code = ? WHERE id = ?',
        [newCode, item.id]
      );
      
      // Update stock_ledger
      await connection.execute(
        'UPDATE stock_ledger SET item_code = ? WHERE item_code = ?',
        [newCode, item.item_code]
      );
      
      // Update stock_entry_items
      await connection.execute(
        'UPDATE stock_entry_items SET item_code = ? WHERE item_code = ?',
        [newCode, item.item_code]
      );
    }
    
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

fixNumericItemCodes();
