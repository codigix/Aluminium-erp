const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp',
    port: 3307
  });
  try {
    const [rows] = await pool.query('SHOW COLUMNS FROM stock_balance');
    console.log(rows.map(r => r.Field));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
