const pool = require('./src/config/db');

async function migrate() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM procurement_rfq_items LIKE 'required_weight'");
    if (cols.length === 0) {
      console.log('Adding required_weight column to procurement_rfq_items...');
      await pool.query('ALTER TABLE procurement_rfq_items ADD COLUMN required_weight decimal(14,3) DEFAULT 0.000 AFTER quantity');
      console.log('Column required_weight added successfully.');
    } else {
      console.log('Column required_weight already exists.');
    }
    const [checkCols] = await pool.query('DESCRIBE procurement_rfq_items');
    console.log('Columns:', checkCols.map(c => c.Field));
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
