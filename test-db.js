const pool = require('./backend/src/config/db');

async function check() {
  try {
    const [rows] = await pool.query('SELECT * FROM warehouses');
    console.log('Warehouses in DB:', rows);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit();
  }
}

check();
