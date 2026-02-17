const mysql = require('mysql2/promise');

async function checkColumns() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'backend',
    database: 'sales_erp',
    port: 3306
  });

  try {
    const [rows] = await connection.query('SHOW COLUMNS FROM sales_order_items');
    console.table(rows);
  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

checkColumns();
