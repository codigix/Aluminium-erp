const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/config/db');

async function check() {
  try {
    const [rows] = await db.query(`
      SELECT u.email, r.code as role_code, r.id as role_id 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.email = 'production@company.com'
    `);
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
