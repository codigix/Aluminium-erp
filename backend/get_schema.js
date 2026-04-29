const mysql = require('mysql2/promise');
require('dotenv').config();

async function getSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [quotations] = await connection.query('DESCRIBE quotations');
    console.log('--- quotations ---');
    console.table(quotations);

    const [quotation_items] = await connection.query('DESCRIBE quotation_items');
    console.log('--- quotation_items ---');
    console.table(quotation_items);
  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

getSchema();
