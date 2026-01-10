const pool = require('./backend/src/config/db');

async function checkSchema() {
  try {
    const [columns] = await pool.query('DESCRIBE sales_order_items');
    console.log('sales_order_items Schema:');
    console.table(columns);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
