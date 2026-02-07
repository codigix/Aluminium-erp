const pool = require('./backend/src/config/db');

async function check() {
  try {
    const [rows] = await pool.query('DESCRIBE quotation_items');
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
