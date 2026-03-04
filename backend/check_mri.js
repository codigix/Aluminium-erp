const pool = require('./src/config/db');

async function check() {
  try {
    const [rows] = await pool.query('DESCRIBE material_request_items');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

check();
