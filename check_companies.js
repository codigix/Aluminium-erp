const pool = require('./backend/src/config/db');

async function checkCompanies() {
  try {
    const [rows] = await pool.query('SELECT * FROM companies');
    console.log(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkCompanies();
