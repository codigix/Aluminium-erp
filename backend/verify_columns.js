const pool = require('./src/config/db');

async function verify() {
  try {
    const [rows] = await pool.query("DESCRIBE customer_drawings");
    console.table(rows);
  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    process.exit(0);
  }
}

verify();
