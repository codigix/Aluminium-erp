const jwt = require('jsonwebtoken');
const pool = require('./src/config/db');

async function debugUserToken(userId) {
  try {
    console.log(`🔍 Debugging user ${userId} token permissions...\n`);

    // Get user info from DB
    const [user] = await pool.query(`
      SELECT u.id, u.username, u.role_id, r.code as role FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `, [userId]);

    if (!user.length) {
      console.log(`❌ User ${userId} not found`);
      process.exit(1);
    }

    const userData = user[0];
    console.log(`👤 User: ${userData.username} (ID: ${userData.id})`);
    console.log(`🔐 Role: ${userData.role} (ID: ${userData.role_id})\n`);

    // Get current DB permissions
    const [dbPerms] = await pool.query(`
      SELECT p.code FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ?
      ORDER BY p.code
    `, [userData.role_id]);

    const dbPermissions = dbPerms.map(p => p.code);
    console.log(`📋 Current Database Permissions (${dbPermissions.length}):`);
    dbPermissions.forEach(perm => {
      const icon = perm.includes('PAYMENT') ? '🟢' : '⚪';
      console.log(`   ${icon} ${perm}`);
    });

    // Create what a NEW token would look like
    console.log('\n✅ NEW Token would include:');
    console.log(`   {`);
    console.log(`     "id": ${userData.id},`);
    console.log(`     "username": "${userData.username}",`);
    console.log(`     "role": "${userData.role}",`);
    console.log(`     "role_id": ${userData.role_id},`);
    console.log(`     "permissions": [${dbPermissions.map(p => `"${p}"`).join(', ')}]`);
    console.log(`   }`);

    console.log('\n\n⚠️  IMPORTANT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ User needs to LOG OUT and LOG IN again!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Steps:');
    console.log('  1. Go to Payment Processing page');
    console.log('  2. Click Logout');
    console.log('  3. Log back in as accounts_user');
    console.log('  4. Try "Send to Payment" again ✅\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Check user 5 by default
debugUserToken(5);
