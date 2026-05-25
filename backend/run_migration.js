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
    console.log('Describing customer_po_item_subassemblies...');
    const [rows] = await connection.query("DESCRIBE customer_po_item_subassemblies");
    console.table(rows);
  } catch (err) {
    console.error('Error describing customer_po_item_subassemblies:', err.message);
  }

  try {
    console.log('Adding hsn_code and delivery_date to customer_po_item_subassemblies...');
    await connection.query("ALTER TABLE customer_po_item_subassemblies ADD COLUMN hsn_code VARCHAR(20) DEFAULT NULL, ADD COLUMN delivery_date DATE DEFAULT NULL");
    console.log('Success.');
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log('Columns already exist.');
    } else {
      console.error('Error adding columns:', err.message);
    }
  }

  await connection.end();
}

run().catch(console.error);
