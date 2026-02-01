const pool = require('./backend/src/config/db');

async function migrate() {
  try {
    console.log('Adding item_group column to stock_balance...');
    const [columns] = await pool.query('SHOW COLUMNS FROM stock_balance LIKE "item_group"');
    if (columns.length === 0) {
      await pool.query('ALTER TABLE stock_balance ADD COLUMN item_group VARCHAR(100) AFTER material_type');
      console.log('Column added successfully.');
    } else {
      console.log('Column already exists.');
    }
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
