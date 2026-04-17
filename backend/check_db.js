const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function checkTables() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  };

  const connection = await mysql.createConnection(config);
  try {
    const [tables] = await connection.query("SHOW TABLES LIKE 'inward_challans'");
    console.log('Tables matching inward_challans:', tables);

    if (tables.length > 0) {
      const [columns] = await connection.query("SHOW COLUMNS FROM inward_challans");
      console.log('Columns in inward_challans:', columns.map(c => c.Field));
    }

    const [itemsTables] = await connection.query("SHOW TABLES LIKE 'inward_challan_items'");
    console.log('Tables matching inward_challan_items:', itemsTables);

    if (itemsTables.length > 0) {
      const [columns] = await connection.query("SHOW COLUMNS FROM inward_challan_items");
      console.log('Columns in inward_challan_items:', columns.map(c => c.Field));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkTables();
