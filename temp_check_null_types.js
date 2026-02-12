const pool = require('./backend/src/config/db');

async function check() {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM material_request_items WHERE item_type IS NULL');
    console.log(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
