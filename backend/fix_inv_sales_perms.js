const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/config/db');

async function fixPermissions() {
  try {
    console.log('Starting permission fix...');

    const rolesToUpdate = ['INV_MGR', 'SALES_MGR'];
    const permissionsToGrant = [
      'PURCHASE_ORDER_VIEW',
      'BOM_VIEW'
    ];

    const invMgrExtraPerms = [
      'GRN_CREATE',
      'GRN_EDIT',
      'PURCHASE_ORDER_EDIT' // Added for po-receipts creation if needed
    ];

    for (const roleCode of rolesToUpdate) {
      const [role] = await db.query("SELECT id FROM roles WHERE code = ?", [roleCode]);
      if (role.length === 0) {
        console.error(`Role ${roleCode} not found`);
        continue;
      }

      const roleId = role[0].id;

      // Grant shared permissions
      for (const permCode of permissionsToGrant) {
        const [perm] = await db.query("SELECT id FROM permissions WHERE code = ?", [permCode]);
        if (perm.length > 0) {
          await db.query("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)", [roleId, perm[0].id]);
          console.log(`✓ ${permCode} granted to ${roleCode}`);
        } else {
          console.error(`Permission ${permCode} not found`);
        }
      }

      // Grant extra permissions to INV_MGR
      if (roleCode === 'INV_MGR') {
        for (const permCode of invMgrExtraPerms) {
          const [perm] = await db.query("SELECT id FROM permissions WHERE code = ?", [permCode]);
          if (perm.length > 0) {
            await db.query("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)", [roleId, perm[0].id]);
            console.log(`✓ ${permCode} granted to ${roleCode}`);
          } else {
            console.error(`Permission ${permCode} not found`);
          }
        }
      }
    }

    console.log('Permission fix completed.');
    process.exit(0);
  } catch (err) {
    console.error('Error fixing permissions:', err);
    process.exit(1);
  }
}

fixPermissions();
