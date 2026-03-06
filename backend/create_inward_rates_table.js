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
    
    console.log('Creating job_card_inward_item_rates table...');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS job_card_inward_item_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quality_log_id INT NOT NULL,
        item_code VARCHAR(100) NOT NULL,
        release_qty DECIMAL(12, 3) DEFAULT 0.000,
        rate DECIMAL(15, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (quality_log_id),
        FOREIGN KEY (quality_log_id) REFERENCES job_card_quality_logs(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    
    console.log('Table created successfully.');
    await db.end();
  } catch (error) {
    console.error('Migration failed:', error);
  }
}
migrate();
