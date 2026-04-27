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
    console.log('Adding version and base_quote_number columns...');
    
    // 1. Add version column
    await connection.query('ALTER TABLE quotations ADD COLUMN version INT DEFAULT 1');
    
    // 2. Add base_quote_number column
    await connection.query('ALTER TABLE quotations ADD COLUMN base_quote_number VARCHAR(100)');
    
    // 3. Initialize base_quote_number with existing quote_number
    await connection.query('UPDATE quotations SET base_quote_number = quote_number');
    
    // 4. Drop old unique constraint on quote_number
    // First find the constraint name
    const [rows] = await connection.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'quotations' 
      AND CONSTRAINT_TYPE = 'UNIQUE'
      AND CONSTRAINT_NAME = 'quote_number'
    `, [process.env.DB_NAME]);
    
    if (rows.length > 0) {
      console.log('Dropping unique constraint: quote_number');
      await connection.query('ALTER TABLE quotations DROP INDEX quote_number');
    }

    // 5. Add new composite unique constraint
    console.log('Adding composite unique constraint (base_quote_number, version)');
    await connection.query('ALTER TABLE quotations ADD UNIQUE KEY base_quote_version (base_quote_number, version)');
    
    console.log('Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
