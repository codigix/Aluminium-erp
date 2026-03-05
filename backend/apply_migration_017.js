const pool = require('./src/config/db');

async function runMigration() {
  try {
    console.log('Starting migration: Adding manual_bank_account to customer_payments...');
    
    // Check if column exists first to avoid error if script is rerun
    const [columns] = await pool.query('SHOW COLUMNS FROM customer_payments LIKE "manual_bank_account"');
    
    if (columns.length === 0) {
      await pool.query('ALTER TABLE customer_payments ADD COLUMN manual_bank_account VARCHAR(255) NULL AFTER bank_account_id');
      console.log('Added manual_bank_account column.');
    } else {
      console.log('Column manual_bank_account already exists.');
    }
    
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();