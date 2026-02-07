const pool = require('./backend/src/config/db');

async function checkSchema() {
  try {
    const [rows] = await pool.query('DESCRIBE sales_orders');
    console.log('Columns in sales_orders:');
    rows.forEach(row => console.log(`- ${row.Field}`));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkSchema();
