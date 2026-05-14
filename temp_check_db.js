const pool = require('./backend/src/config/db');
async function run() {
  try {
    const [rows] = await pool.query('SHOW DATABASES');
    console.log('Databases:', rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
