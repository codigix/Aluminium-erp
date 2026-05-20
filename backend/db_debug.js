const pool = require('./src/config/db');

async function run() {
  try {
    console.log("--- customer_drawings ---");
    const [drawings] = await pool.query(
      `SELECT id, drawing_no, client_name, project_name, description, drawing_type, status 
       FROM customer_drawings`
    );
    console.table(drawings);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
run();
