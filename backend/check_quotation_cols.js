const pool = require('./src/config/db');
async function check() {
  const [rows] = await pool.query('DESCRIBE quotations');
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
check();
