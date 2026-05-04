const pool = require('./backend/src/config/db');
async function check() {
  try {
    const [rows] = await pool.query('SELECT department FROM material_requests LIMIT 5');
    console.log('Sample Department values:', rows);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();
