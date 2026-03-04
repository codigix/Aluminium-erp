const pool = require('./backend/src/config/db');

async function debugItems() {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT id, item_code, material_name, material_type, current_balance FROM stock_balance ORDER BY material_name"
    );
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

debugItems();
