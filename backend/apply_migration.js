const pool = require('./src/config/db');

async function runMigration() {
  try {
    console.log('Starting migration: Adding mr_id to quotations...');
    
    // Check if column exists first to avoid error if script is rerun
    const [columns] = await pool.query('SHOW COLUMNS FROM quotations LIKE "mr_id"');
    
    if (columns.length === 0) {
      await pool.query('ALTER TABLE quotations ADD COLUMN mr_id INT AFTER sales_order_id');
      console.log('Added mr_id column.');
      
      await pool.query('ALTER TABLE quotations ADD CONSTRAINT fk_quotations_mr FOREIGN KEY (mr_id) REFERENCES material_requests(id) ON DELETE SET NULL');
      console.log('Added foreign key constraint.');
    } else {
      console.log('Column mr_id already exists.');
    }
    
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
