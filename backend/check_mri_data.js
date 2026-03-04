const pool = require('./src/config/db');

async function check() {
  try {
    const [rows] = await pool.query('SELECT * FROM material_request_items LIMIT 5');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

check();
