const pool = require('./backend/src/config/db');

async function run() {
  try {
    console.log('Adding delivery_date column to customer_drawings...');
    
    // 1. Check if column exists
    const [columns] = await pool.query("SHOW COLUMNS FROM customer_drawings LIKE 'delivery_date'");
    if (columns.length === 0) {
      await pool.query("ALTER TABLE customer_drawings ADD COLUMN delivery_date DATE NULL AFTER hsn_code");
      console.log('Successfully added delivery_date column!');
    } else {
      console.log('delivery_date column already exists.');
    }
  } catch (err) {
    console.error('Error adding delivery_date column:', err);
  } finally {
    await pool.end();
  }
}

run();
