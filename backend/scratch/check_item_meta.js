const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME
  });

  const [cols] = await pool.query('SHOW COLUMNS FROM items');
  console.log('Columns of items:', cols.map(c => c.Field));

  const [items] = await pool.query('SELECT item_code, item_group FROM items WHERE item_code IN ("114257", "122620", "PART-GEARZ120M6-0001", "BO-TRONCHCLAMP508M-0001")');
  console.log('Items table check:', items);

  const [soiComps] = await pool.query('SELECT component_code, item_group FROM sales_order_item_components WHERE component_code IN ("114257", "122620", "PART-GEARZ120M6-0001") LIMIT 5');
  console.log('sales_order_item_components check:', soiComps);

  process.exit(0);
})();
