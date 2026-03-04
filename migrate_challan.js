const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('Adding hsn and weight columns to delivery_challan_items...');
    
    await connection.execute(`
      ALTER TABLE delivery_challan_items 
      ADD COLUMN IF NOT EXISTS hsn VARCHAR(20) DEFAULT '732690',
      ADD COLUMN IF NOT EXISTS weight DECIMAL(12, 3) DEFAULT 0
    `);

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
