const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'spTech_dev',
    port: 3307
  });

  try {
    console.log('Adding hsn_code and delivery_date to order_items...');
    await connection.execute(`
      ALTER TABLE order_items 
      ADD COLUMN hsn_code VARCHAR(50) NULL AFTER type,
      ADD COLUMN delivery_date DATE NULL AFTER hsn_code
    `);
    console.log('Migration successful!');
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log('Columns already exist.');
    } else {
      console.error('Migration failed:', err);
    }
  } finally {
    await connection.end();
  }
}

migrate();
