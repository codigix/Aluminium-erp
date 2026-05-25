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
    console.log('--- order_items ---');
    const [rows1] = await connection.query("DESCRIBE order_items");
    console.table(rows1);

    console.log('--- customer_po_item_subassemblies ---');
    const [rows2] = await connection.query("DESCRIBE customer_po_item_subassemblies");
    console.table(rows2);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

run();
