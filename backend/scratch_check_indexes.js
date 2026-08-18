const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkIndexes() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spTech_dev'
  };

  const connection = await mysql.createConnection(config);

  const showIndexes = async (table) => {
    console.log(`\n--- Indexes for table: ${table} ---`);
    const [rows] = await connection.query(`SHOW INDEX FROM ${table}`);
    rows.forEach(r => {
      console.log(`  Index: ${r.Key_name} | Column: ${r.Column_name} | Non_unique: ${r.Non_unique}`);
    });
  };

  try {
    await showIndexes('orders');
    await showIndexes('quotation_requests');
    await showIndexes('customer_pos');
    await showIndexes('companies');
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkIndexes();
