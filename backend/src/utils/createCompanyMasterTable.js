const pool = require('../config/db');

async function createTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS company_master (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      company_address TEXT,
      gstin VARCHAR(50),
      pan VARCHAR(50),
      bank_name VARCHAR(255),
      account_number VARCHAR(100),
      ifsc_code VARCHAR(50),
      branch_name VARCHAR(255),
      authorized_signature VARCHAR(500),
      company_logo VARCHAR(500),
      invoice_footer_notes TEXT,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `;

  try {
    console.log('Creating company_master table if not exists...');
    await pool.query(query);
    console.log('✅ Table company_master created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    process.exit(1);
  }
}

createTable();
