const db = require('./backend/src/config/db');

async function fixPermissions() {
  try {
    console.log('Starting permission fix...');
    
    // 1. Get role IDs for roles that need DESIGN_VIEW
    const [roles] = await db.query("SELECT id, code FROM roles WHERE code IN ('SALES_MGR', 'ACC_MGR', 'SHIP_OFFICER', 'PROD_MGR', 'INV_MGR')");
    const roleMap = roles.reduce((acc, r) => ({ ...acc, [r.code]: r.id }), {});
    
    // 2. Get permission IDs for DESIGN_VIEW and DESIGN_MANAGE
    const [perms] = await db.query("SELECT id, code FROM permissions WHERE code IN ('DESIGN_VIEW', 'DESIGN_MANAGE')");
    const permMap = perms.reduce((acc, p) => ({ ...acc, [p.code]: p.id }), {});
    
    if (!permMap['DESIGN_VIEW'] || !permMap['DESIGN_MANAGE']) {
      console.error('Permissions not found in DB. Make sure seed-data.sql has been run at least once.');
      process.exit(1);
    }

    // 3. Helper to grant permission
    const grant = async (roleCode, permCode) => {
      const roleId = roleMap[roleCode];
      const permId = permMap[permCode];
      if (roleId && permId) {
        await db.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, permId]);
        console.log(`Granted ${permCode} to ${roleCode}`);
      }
    };

    // SALES_MGR needs both
    await grant('SALES_MGR', 'DESIGN_VIEW');
    await grant('SALES_MGR', 'DESIGN_MANAGE');
    
    // Others might only need VIEW
    await grant('ACC_MGR', 'DESIGN_VIEW');
    await grant('SHIP_OFFICER', 'DESIGN_VIEW');
    await grant('PROD_MGR', 'DESIGN_VIEW');
    await grant('INV_MGR', 'DESIGN_VIEW');

    console.log('Permissions fixed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing permissions:', error);
    process.exit(1);
  }
}

fixPermissions();
