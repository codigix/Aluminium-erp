const pool = require('../src/config/db');

async function up() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_allocations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        payment_id INT NOT NULL,
        voucher_no VARCHAR(100) NOT NULL,
        vendor_id INT NOT NULL,
        po_id INT NULL,
        invoice_id INT NULL,
        allocation_type VARCHAR(50) DEFAULT 'Agst Ref',
        reference_no VARCHAR(100) NULL,
        amount DECIMAL(14,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_payment_id (payment_id),
        INDEX idx_voucher_no (voucher_no),
        INDEX idx_po_id (po_id),
        INDEX idx_vendor_id (vendor_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('payment_allocations table created or verified successfully');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    process.exit(0);
  }
}

up();
