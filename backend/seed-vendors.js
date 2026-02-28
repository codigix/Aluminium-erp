const mysql = require('mysql2');
require('dotenv').config({ path: '.env' });

async function seed() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sales_erp'
  };

  const connection = await mysql.createConnection(config).promise();

  try {
    console.log('Seeding vendors...');
    const vendors = [
      ['VND-001', 'Precision Tools Ltd', 'Service Provider', 'Active'],
      ['VND-002', 'Alu Casting Corp', 'Material Supplier', 'Active'],
      ['VND-003', 'Quality QC Services', 'Service Provider', 'Active']
    ];

    for (const v of vendors) {
      await connection.execute(
        'INSERT IGNORE INTO vendors (vendor_code, vendor_name, category, status) VALUES (?, ?, ?, ?)',
        v
      );
    }

    console.log('Seeding items...');
    const items = [
      ['RM-ALU-001', 'Aluminium Ingot', 'RAW_MATERIAL', 'KG'],
      ['RM-SCR-001', 'Aluminium Scrap', 'RAW_MATERIAL', 'KG'],
      ['FG-RING-001', 'Ring Fitting', 'FINISHED_GOODS', 'Units']
    ];

    for (const i of items) {
      await connection.execute(
        'INSERT IGNORE INTO stock_balance (item_code, material_name, material_type, unit) VALUES (?, ?, ?, ?)',
        i
      );
    }

    console.log('Seeding complete!');
  } catch (err) {
    console.error('Seeding failed:', err.message);
  } finally {
    await connection.end();
  }
}

seed();
