const pool = require('./src/config/db');

async function runMigration() {
  try {
    console.log('Starting migration 027: Adding igst_rate and is_interstate to orders and sales_orders...');

    // 1. orders
    const [orderCols] = await pool.query('SHOW COLUMNS FROM orders');
    const orderColSet = new Set(orderCols.map(c => c.Field));

    if (!orderColSet.has('igst_rate')) {
      await pool.query('ALTER TABLE orders ADD COLUMN igst_rate DECIMAL(5,2) DEFAULT 0.00 AFTER sgst_rate');
      console.log('Added igst_rate to orders.');
    } else {
      console.log('orders.igst_rate already exists.');
    }

    if (!orderColSet.has('is_interstate')) {
      await pool.query('ALTER TABLE orders ADD COLUMN is_interstate TINYINT(1) DEFAULT 0 AFTER igst_rate');
      console.log('Added is_interstate to orders.');
    } else {
      console.log('orders.is_interstate already exists.');
    }

    // 2. sales_orders
    const [soCols] = await pool.query('SHOW COLUMNS FROM sales_orders');
    const soColSet = new Set(soCols.map(c => c.Field));

    if (!soColSet.has('igst_rate')) {
      await pool.query('ALTER TABLE sales_orders ADD COLUMN igst_rate DECIMAL(5,2) DEFAULT 0.00 AFTER sgst_rate');
      console.log('Added igst_rate to sales_orders.');
    } else {
      console.log('sales_orders.igst_rate already exists.');
    }

    if (!soColSet.has('is_interstate')) {
      await pool.query('ALTER TABLE sales_orders ADD COLUMN is_interstate TINYINT(1) DEFAULT 0 AFTER igst_rate');
      console.log('Added is_interstate to sales_orders.');
    } else {
      console.log('sales_orders.is_interstate already exists.');
    }

    console.log('Migration 027 completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration 027 failed:', error);
    process.exit(1);
  }
}

runMigration();
