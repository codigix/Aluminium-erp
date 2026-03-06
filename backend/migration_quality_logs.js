const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function migrate() {
  try {
    const config = {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3307,
      user: process.env.DB_USER || 'aluminium_user',
      password: process.env.DB_PASSWORD || 'C0digix$309',
      database: process.env.DB_NAME || 'sales_erp'
    };
    const db = await mysql.createConnection(config);
    
    console.log('Adding columns to job_card_quality_logs...');
    
    await db.query(`
      ALTER TABLE job_card_quality_logs 
      ADD COLUMN vendor_invoice VARCHAR(255) AFTER status,
      ADD COLUMN sub_total DECIMAL(15, 2) DEFAULT 0.00 AFTER vendor_invoice,
      ADD COLUMN gst_amount DECIMAL(15, 2) DEFAULT 0.00 AFTER sub_total,
      ADD COLUMN grand_total DECIMAL(15, 2) DEFAULT 0.00 AFTER gst_amount
    `);
    
    console.log('Columns added successfully.');
    await db.end();
  } catch (error) {
    console.error('Migration failed:', error);
  }
}
migrate();
