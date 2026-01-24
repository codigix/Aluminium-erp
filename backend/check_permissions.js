const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/config/db');

async function check() {
  try {
    console.log("--- All Permissions ---");
    const [perms] = await db.query("SELECT * FROM permissions");
    console.log(JSON.stringify(perms, null, 2));

    console.log("\n--- Role-Permission Mapping ---");
    const [mapping] = await db.query(`
      SELECT r.code as role, p.code as permission 
      FROM role_permissions rp 
      JOIN roles r ON rp.role_id = r.id 
      JOIN permissions p ON rp.permission_id = p.id
    `);
    console.log(JSON.stringify(mapping, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
