const pool = require('../src/config/db');

async function migrate() {
  try {
    console.log('Adding public_id to quotation_requests...');
    await pool.query('ALTER TABLE quotation_requests ADD COLUMN public_id VARCHAR(100) UNIQUE AFTER id');
    
    console.log('Adding public_id to customer_drawings...');
    await pool.query('ALTER TABLE customer_drawings ADD COLUMN public_id VARCHAR(100) UNIQUE AFTER id');
    
    console.log('Migration completed successfully');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

migrate();
