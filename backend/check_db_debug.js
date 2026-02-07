const mysql = require('mysql2');
require('dotenv').config({ path: 'backend/.env' });

async function checkDB() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'aluminium_erp'
  }).promise();

  try {
    const drawingNo = '9000011003';
    console.log(`Checking for drawing_no: ${drawingNo}`);

    const [materials] = await connection.query('SELECT * FROM sales_order_item_materials WHERE drawing_no = ?', [drawingNo]);
    console.log(`Materials found: ${materials.length}`);
    if (materials.length > 0) console.log(materials);

    const [operations] = await connection.query('SELECT * FROM sales_order_item_operations WHERE drawing_no = ?', [drawingNo]);
    console.log(`Operations found: ${operations.length}`);
    if (operations.length > 0) console.log(operations);

    const [components] = await connection.query('SELECT * FROM sales_order_item_components WHERE drawing_no = ?', [drawingNo]);
    console.log(`Components found: ${components.length}`);
    if (components.length > 0) console.log(components);

    const [items] = await connection.query('SELECT * FROM sales_order_items WHERE id = 1');
    console.log(`Item ID 1 found: ${items.length}`);
    if (items.length > 0) console.log(items[0]);

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkDB();
