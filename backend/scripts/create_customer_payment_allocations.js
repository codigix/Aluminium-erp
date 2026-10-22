const pool = require('../src/config/db');

async function up() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_payment_allocations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_payment_id INT NOT NULL,
        receipt_no VARCHAR(100) NOT NULL,
        customer_id INT NOT NULL,
        invoice_id INT NULL,
        sales_order_id INT NULL,
        sales_order_source VARCHAR(50) DEFAULT 'SALES_INVOICE',
        allocation_type VARCHAR(50) DEFAULT 'Agst Ref',
        reference_no VARCHAR(100) NULL,
        amount DECIMAL(14,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cpa_pmt_id (customer_payment_id),
        INDEX idx_cpa_receipt_no (receipt_no),
        INDEX idx_cpa_invoice_id (invoice_id),
        INDEX idx_cpa_so_id (sales_order_id),
        INDEX idx_cpa_cust_id (customer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('customer_payment_allocations table created or verified successfully');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    process.exit(0);
  }
}

up();
