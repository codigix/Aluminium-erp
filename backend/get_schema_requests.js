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
    const [rows] = await connection.query('SHOW TABLES LIKE "quotation_requests%"');
    console.log('Tables:', rows);

    for (const row of rows) {
      const tableName = Object.values(row)[0];
      const [schema] = await connection.query(`DESCRIBE ${tableName}`);
      console.log(`--- ${tableName} ---`);
      console.table(schema);
    }
  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

getSchema();
