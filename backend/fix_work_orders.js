const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'backend',
  database: process.env.DB_NAME || 'sales_erp'
};

async function fixWorkOrders() {
  let connection;
  try {
    connection = await mysql.createConnection(baseConfig);
    console.log('Connected to database');

    const table = 'work_orders';
    console.log(`Checking table: ${table}`);
    
    const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
    const existing = new Set(columns.map(c => c.Field));
    
    if (!existing.has('public_id')) {
      console.log(`Adding public_id to ${table}`);
      await connection.query(`ALTER TABLE ${table} ADD COLUMN public_id VARCHAR(100) UNIQUE NULL`);
    } else {
      console.log(`public_id already exists in ${table}`);
    }

    // Backfill NULL public_id
    const [rows] = await connection.query(`SELECT id FROM ${table} WHERE public_id IS NULL`);
    console.log(`Found ${rows.length} records in ${table} needing public_id`);
    
    for (const row of rows) {
      const publicId = crypto.randomUUID();
      await connection.query(`UPDATE ${table} SET public_id = ? WHERE id = ?`, [publicId, row.id]);
    }
    if (rows.length > 0) console.log(`Backfilled ${rows.length} records in ${table}`);

    console.log('Database fix completed');
  } catch (error) {
    console.error('Database connection failed', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

fixWorkOrders();
