const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/config/db');

async function grant() {
  try {
    const [roles] = await db.query("SELECT id FROM roles WHERE code = 'PROD_MGR'");
    const [perms] = await db.query("SELECT id FROM permissions WHERE code = 'PURCHASE_ORDER_VIEW'");

    if (roles.length > 0 && perms.length > 0) {
      await db.query("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)", [roles[0].id, perms[0].id]);
      console.log("✓ PURCHASE_ORDER_VIEW granted to PROD_MGR");
    } else {
      console.error("Error: PROD_MGR role or PURCHASE_ORDER_VIEW permission not found");
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
grant();
