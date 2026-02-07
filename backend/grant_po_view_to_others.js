const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/config/db');

async function grant() {
  try {
    const [roles] = await db.query("SELECT id, code FROM roles WHERE code IN ('INV_MGR', 'QA_INSP')");
    const [perms] = await db.query("SELECT id FROM permissions WHERE code = 'PURCHASE_ORDER_VIEW'");

    if (perms.length > 0) {
      for (const role of roles) {
        await db.query("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)", [role.id, perms[0].id]);
        console.log(`✓ PURCHASE_ORDER_VIEW granted to ${role.code}`);
      }
    } else {
      console.error("Error: PURCHASE_ORDER_VIEW permission not found");
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
grant();
