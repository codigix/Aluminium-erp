const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'spTech_prod',
    port: 3307
  });
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM quotation_requests");
    console.log('quotation_requests columns:', cols.map(c => c.Field));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
