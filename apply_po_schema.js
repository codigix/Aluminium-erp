const mysql = require('mysql2');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'backend',
  database: process.env.DB_NAME || 'sales_erp'
};

const applySchema = async () => {
  const connection = mysql.createConnection(config).promise();
  try {
    console.log('Connected to database');

    const [columns] = await connection.query('SHOW COLUMNS FROM purchase_order_items');
    const existing = new Set(columns.map(c => c.Field));

    const required = [
      { name: 'cgst_percent', def: 'DECIMAL(5, 2) DEFAULT 0' },
      { name: 'cgst_amount', def: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'sgst_percent', def: 'DECIMAL(5, 2) DEFAULT 0' },
      { name: 'sgst_amount', def: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'total_amount', def: 'DECIMAL(14, 2) DEFAULT 0' }
    ];

    for (const col of required) {
      if (!existing.has(col.name)) {
        console.log(`Adding column ${col.name}...`);
        await connection.query(`ALTER TABLE purchase_order_items ADD COLUMN ${col.name} ${col.def}`);
      } else {
        console.log(`Column ${col.name} already exists`);
      }
    }

    console.log('Schema update completed successfully');
  } catch (error) {
    console.error('Schema update failed:', error.message);
  } finally {
    if (connection) await connection.end();
  }
};

applySchema();