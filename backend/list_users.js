const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/config/db');
async function list() {
  try {
    const [rows] = await db.query("SELECT u.id, u.email, u.role_id, r.code as role_code, d.code as department FROM users u JOIN departments d ON u.department_id = d.id JOIN roles r ON u.role_id = r.id");
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
list();
