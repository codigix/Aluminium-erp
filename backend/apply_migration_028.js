const pool = require('./src/config/db');

async function runMigration() {
  try {
    console.log('Starting migration 028: Adding host_company_id to sales_invoices...');

    const [cols] = await pool.query('SHOW COLUMNS FROM sales_invoices');
    const colSet = new Set(cols.map(c => c.Field));

    if (!colSet.has('host_company_id')) {
      await pool.query('ALTER TABLE sales_invoices ADD COLUMN host_company_id INT NULL AFTER client_id');
      console.log('Added host_company_id to sales_invoices.');
    } else {
      console.log('sales_invoices.host_company_id already exists.');
    }

    // Also backfill existing sales_invoices from orders if available
    await pool.query(`
      UPDATE sales_invoices si
      JOIN orders o ON o.id = si.order_id
      SET si.host_company_id = o.host_company_id
      WHERE si.host_company_id IS NULL AND o.host_company_id IS NOT NULL
    `);
    console.log('Backfilled existing sales_invoices.host_company_id from orders.');

    console.log('Migration 028 completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration 028 failed:', error);
    process.exit(1);
  }
}

runMigration();
