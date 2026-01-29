const pool = require('./src/config/db');
async function run() {
  try {
    const [rows] = await pool.query('SELECT * FROM quotation_communications WHERE quotation_id = 7');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
run();
