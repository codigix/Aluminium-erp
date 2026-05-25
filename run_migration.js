const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'spTech_dev'
  });

  try {
    console.log('Running migration...');
    await connection.execute(`
      ALTER TABLE customer_po_item_subassemblies 
      ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20) DEFAULT NULL, 
      ADD COLUMN IF NOT EXISTS delivery_date DATE DEFAULT NULL;
    `);
    console.log('Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

run();
