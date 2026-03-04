const pool = require('./backend/src/config/db');

async function updatePermissions() {
  try {
    const [rows] = await pool.query("SELECT id FROM permissions WHERE code = 'PURCHASE_ORDER_DELETE'");
    if (rows.length > 0) {
      const permissionId = rows[0].id;
      await pool.query("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (3, ?)", [permissionId]);
      console.log('Permission PURCHASE_ORDER_DELETE granted to Role 3');
    } else {
      console.error('Permission PURCHASE_ORDER_DELETE not found');
    }
  } catch (error) {
    console.error('Error updating permissions:', error.message);
  } finally {
    process.exit(0);
  }
}

updatePermissions();
