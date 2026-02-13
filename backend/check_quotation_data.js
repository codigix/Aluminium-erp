const pool = require('./src/config/db');
async function check() {
  const [rows] = await pool.query('SELECT id, quote_number FROM quotations LIMIT 10');
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
check();
