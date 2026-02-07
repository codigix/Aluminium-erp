const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fix() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    console.log('Finding all foreign keys for work_orders...');
    const [fks] = await connection.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'work_orders' AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [process.env.DB_NAME || 'sales_erp']);

    for (const fk of fks) {
      console.log(`Dropping foreign key ${fk.CONSTRAINT_NAME}...`);
      await connection.query(`ALTER TABLE work_orders DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
    }

    console.log('Modifying columns to be nullable...');
    await connection.query("ALTER TABLE work_orders MODIFY COLUMN sales_order_id INT NULL");
    await connection.query("ALTER TABLE work_orders MODIFY COLUMN sales_order_item_id INT NULL");
    
    console.log('Success!');
  } catch (e) {
    console.log('Error:', e.message);
  }

  await connection.end();
}

fix();
