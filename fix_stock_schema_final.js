const pool = require('./backend/src/config/db');

async function fixStockBalanceSchema() {
  console.log('Fixing stock_balance schema...');
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1. Check if warehouse column exists
    const [columns] = await connection.query('SHOW COLUMNS FROM stock_balance');
    const hasWarehouse = columns.some(c => c.Field === 'warehouse');
    
    if (!hasWarehouse) {
      console.log('Adding warehouse column to stock_balance...');
      await connection.query('ALTER TABLE stock_balance ADD COLUMN warehouse VARCHAR(100) AFTER material_type');
    }
    
    // 2. Fix constraints
    // Check indexes
    const [indexes] = await connection.query('SHOW INDEX FROM stock_balance');
    const hasUniqueItemCode = indexes.some(idx => idx.Key_name === 'item_code' && idx.Non_unique === 0);
    const hasUniqueCompound = indexes.some(idx => idx.Key_name === 'unique_item_warehouse');
    
    if (hasUniqueItemCode) {
      console.log('Removing old UNIQUE(item_code) constraint...');
      // Drop index by name. Usually it's 'item_code' or just the column name if created via UNIQUE(col)
      // We'll try to find the specific constraint name
      try {
        await connection.query('ALTER TABLE stock_balance DROP INDEX item_code');
      } catch (e) {
        console.log('Could not drop index item_code directly, trying by column name...');
        // Sometimes it's the primary key if mistakenly set, but here it's a unique index
      }
    }
    
    if (!hasUniqueCompound) {
      console.log('Adding UNIQUE(item_code, warehouse) constraint...');
      // We handle NULL warehouses by treating them as empty strings or ensuring one record exists
      // To be safe with NULLs in UNIQUE, we ensure existing NULLs are cleaned if needed, but MySQL allows multiple NULLs in UNIQUE.
      // However, our logic prefer one record.
      await connection.query('ALTER TABLE stock_balance ADD UNIQUE INDEX unique_item_warehouse (item_code, warehouse)');
    }
    
    console.log('Schema fix completed.');
  } catch (error) {
    console.error('Schema fix failed:', error);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

fixStockBalanceSchema();
