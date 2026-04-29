const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Adding SUPERSEDED to status enum...');
    await connection.query("ALTER TABLE quotations MODIFY COLUMN status ENUM('DRAFT','SENT','RECEIVED','REVIEWED','CLOSED','PENDING','EMAIL_RECEIVED','SUPERSEDED') DEFAULT 'DRAFT'");
    console.log('Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
