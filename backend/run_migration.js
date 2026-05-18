const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'spTech_dev'
  });

  try {
    console.log('Describing customer_drawings...');
    const [rows] = await connection.query("DESCRIBE customer_drawings");
    console.table(rows);
  } catch (err) {
    console.error('Error describing customer_drawings:', err.message);
  }

  try {
    console.log('Adding drawing_type to sales_order_items...');
    await connection.query("ALTER TABLE sales_order_items ADD COLUMN drawing_type VARCHAR(50) DEFAULT 'Part' AFTER description");
    console.log('Success.');
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log('Column drawing_type already exists in sales_order_items.');
    } else {
      console.error('Error adding to sales_order_items:', err.message);
    }
  }

  await connection.end();
}

run().catch(console.error);
