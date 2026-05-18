const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function inspectData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: process.env.DB_NAME || 'spTech_dev',
    port: parseInt(process.env.DB_PORT || '3307')
  });

  try {
    const [drawings] = await connection.query(`
      SELECT id, client_name, project_name, drawing_no, revision, status
      FROM customer_drawings
    `);
    console.log('--- Customer Drawings ---');
    console.log(drawings);

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

inspectData();
