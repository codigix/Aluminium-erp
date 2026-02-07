const pool = require('./backend/src/config/db');

async function run() {
  try {
    const [rows] = await pool.query('DESCRIBE quotation_requests');
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
