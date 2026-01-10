const pool = require('./backend/src/config/db');

async function listTables() {
  try {
    const [rows] = await pool.query('SHOW TABLES');
    console.log('Database Tables:');
    rows.forEach(row => console.log(Object.values(row)[0]));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listTables();
