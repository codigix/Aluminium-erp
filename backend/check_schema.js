require('dotenv').config();
const pool = require('./src/config/db');

async function checkSchema() {
  try {
    const tables = ['sales_order_item_materials', 'sales_order_items', 'customer_drawings'];
    for (const table of tables) {
      const [rows] = await pool.query(`DESCRIBE ${table}`);
      console.log(`Schema for ${table}:`, rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkSchema();
