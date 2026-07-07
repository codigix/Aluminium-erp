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
    const [rows] = await pool.query("SELECT item_code, material_name, material_type, drawing_no, current_balance, warehouse FROM stock_balance WHERE material_name LIKE '%aluminum%' OR material_name LIKE '%tube%' OR item_code LIKE '%aluminum%'");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
