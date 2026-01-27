const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    console.log('--- Table: sales_order_item_materials ---');
    const [columns] = await connection.query('DESCRIBE sales_order_item_materials');
    console.table(columns);

    const [createTable] = await connection.query('SHOW CREATE TABLE sales_order_item_materials');
    console.log(createTable[0]['Create Table']);

    console.log('\n--- Table: sales_order_items ---');
    const [soiColumns] = await connection.query('DESCRIBE sales_order_items');
    console.table(soiColumns);

    const [soiCreateTable] = await connection.query('SHOW CREATE TABLE sales_order_items');
    console.log(soiCreateTable[0]['Create Table']);

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkSchema();
