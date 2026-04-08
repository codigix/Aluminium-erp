const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  });
  try {
    const [cols] = await c.query('SHOW COLUMNS FROM quotation_requests');
    const existing = new Set(cols.map(col => col.Field));
    
    if (!existing.has('drawing_no')) {
      await c.query('ALTER TABLE quotation_requests ADD COLUMN drawing_no VARCHAR(255) DEFAULT NULL');
      console.log('Added drawing_no column');
    }
    
    if (!existing.has('description')) {
      await c.query('ALTER TABLE quotation_requests ADD COLUMN description TEXT DEFAULT NULL');
      console.log('Added description column');
    }

    if (!existing.has('item_unit')) {
      await c.query('ALTER TABLE quotation_requests ADD COLUMN item_unit VARCHAR(50) DEFAULT "Nos"');
      console.log('Added item_unit column');
    }

    console.log('Successfully updated quotation_requests table with item detail columns');
  } catch (e) {
    console.error(e);
  } finally {
    await c.end();
  }
}
run();
