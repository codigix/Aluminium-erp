const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function migrate() {
  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sales_erp',
      port: Number(process.env.DB_PORT || 3306)
    };
    const c = await mysql.createConnection(config);
    console.log('Connected to database. Attempting to modify column...');
    await c.query('ALTER TABLE materials MODIFY COLUMN density VARCHAR(255)');
    console.log('Successfully modified materials.density to VARCHAR(255)');
    await c.end();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}
migrate();
