const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' }); // Current root is parent of backend

async function run() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  };

  const connection = await mysql.createConnection(config);
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS job_card_inward_item_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quality_log_id INT,
        item_code VARCHAR(255),
        release_qty DECIMAL(10,2),
        rate DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table job_card_inward_item_rates created successfully');
  } catch (error) {
    console.error('Error creating table:', error);
  } finally {
    await connection.end();
  }
}

run();
