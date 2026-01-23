require('dotenv').config();
const db = require('./src/config/db');
async function list() {
  try {
    const [rows] = await db.query("SELECT u.email, d.code as department FROM users u JOIN departments d ON u.department_id = d.id");
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
list();
