const pool = require('./backend/src/config/db');

async function describe() {
  try {
    const [rows] = await pool.query('DESCRIBE material_request_items');
    console.log(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

describe();
