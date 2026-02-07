const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'sales_erp'
  });
  try {
    const [ordersCols] = await pool.query('SHOW COLUMNS FROM orders');
    console.log('Orders Columns:', ordersCols.map(c => c.Field));
    const [orderItemsCols] = await pool.query('SHOW COLUMNS FROM order_items');
    console.log('Order Items Columns:', orderItemsCols.map(c => c.Field));
  } catch (e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
})();
