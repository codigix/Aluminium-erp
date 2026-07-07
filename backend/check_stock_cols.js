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
    const [matRows] = await pool.query("SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = 870");
    console.log('materials (870):', matRows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
