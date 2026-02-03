const mysql = require('mysql2/promise');

async function updateItem() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'backend',
    database: 'sales_erp',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    const [result] = await pool.query("UPDATE sales_order_items SET item_type = 'FG' WHERE id = 93");
    console.log(`Updated ${result.affectedRows} rows. Item 93 is now FG.`);
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

updateItem();
