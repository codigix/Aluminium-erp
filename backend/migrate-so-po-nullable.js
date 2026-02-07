const pool = require('./src/config/db');

async function migrate() {
  try {
    console.log('Starting migration: Making customer_po_id nullable in sales_orders...');
    
    // Check if it's already nullable or if we need to change it
    await pool.query(`
      ALTER TABLE sales_orders MODIFY COLUMN customer_po_id INT NULL
    `);
    
    console.log('Migration successful: customer_po_id is now nullable.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
