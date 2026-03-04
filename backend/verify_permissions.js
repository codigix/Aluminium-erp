const pool = require('./src/config/db');

async function verifyPermissions() {
  try {
    console.log('🔍 Verifying payment permissions setup...\n');

    // Check if permissions exist
    const [permissions] = await pool.query(`
      SELECT id, code, name FROM permissions WHERE code LIKE 'PAYMENT%' ORDER BY code
    `);

    console.log('📋 Payment Permissions in Database:');
    if (permissions.length > 0) {
      permissions.forEach(p => {
        console.log(`   ✅ ${p.code}: ID=${p.id}, Name="${p.name}"`);
      });
    } else {
      console.log('   ❌ No payment permissions found!');
    }

    console.log('\n');

    // Get Accounts Manager role
    const [accRole] = await pool.query(`
      SELECT id, code, name FROM roles WHERE code = 'ACC_MGR'
    `);

    if (accRole.length === 0) {
      console.log('❌ Accounts Manager role not found!');
      process.exit(1);
    }

    const roleId = accRole[0].id;
    console.log(`👤 Accounts Manager Role: ID=${roleId}, Code=${accRole[0].code}, Name="${accRole[0].name}"`);

    // Check what permissions are assigned to Accounts Manager
    const [rolePerms] = await pool.query(`
      SELECT p.id, p.code, p.name
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ?
      ORDER BY p.code
    `, [roleId]);

    console.log(`\n👤 Accounts Manager Permissions (${rolePerms.length} total):`);
    if (rolePerms.length > 0) {
      const paymentPerms = [];
      rolePerms.forEach(p => {
        const icon = p.code.includes('PAYMENT') ? '🟢' : '⚪';
        console.log(`   ${icon} ${p.code}`);
        if (p.code.includes('PAYMENT')) {
          paymentPerms.push(p.code);
        }
      });

      if (paymentPerms.length >= 3) {
        console.log(`\n✅ All payment permissions assigned! Found: ${paymentPerms.join(', ')}`);
      } else {
        console.log(`\n⚠️  Missing some payment permissions. Found: ${paymentPerms.join(', ')}`);
      }
    } else {
      console.log('   ❌ No permissions assigned!');
    }

    // Check if user 5 exists and their role
    const [user] = await pool.query(`
      SELECT u.id, u.username, u.role_id, r.code, r.name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = 5
    `);

    if (user.length > 0) {
      console.log(`\n👥 User 5 (${user[0].username}):`);
      console.log(`   Role ID: ${user[0].role_id}`);
      console.log(`   Role Code: ${user[0].code}`);
      console.log(`   Role Name: ${user[0].name}`);

      if (user[0].role_id === roleId) {
        console.log(`\n✅ User 5 is Accounts Manager with role_id ${roleId}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyPermissions();
