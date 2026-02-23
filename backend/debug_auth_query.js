const pool = require('./src/config/db');

async function debugAuthQuery() {
  try {
    console.log('🔍 Debugging auth query that middleware uses...\n');

    // User 5 info
    console.log('Step 1: Get user role_id');
    const [user] = await pool.query('SELECT id, username, role_id FROM users WHERE id = 5');
    console.log(`   User: ${user[0].username} (ID: ${user[0].id})`);
    console.log(`   Role ID: ${user[0].role_id}\n`);

    const roleId = user[0].role_id;

    // Execute THE EXACT query from authMiddleware
    console.log('Step 2: Execute exact middleware query');
    console.log(`   Query: SELECT p.code FROM role_permissions rp`);
    console.log(`          JOIN permissions p ON rp.permission_id = p.id`);
    console.log(`          WHERE rp.role_id = ${roleId}\n`);

    const query = `
      SELECT p.code FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ?
    `;

    const [results] = await pool.query(query, [roleId]);
    
    console.log(`Step 3: Results (${results.length} permissions):`);
    if (results.length > 0) {
      const permissions = results.map(r => r.code);
      permissions.forEach(perm => {
        const icon = perm.includes('PAYMENT') ? '🟢' : '⚪';
        console.log(`   ${icon} ${perm}`);
      });
    } else {
      console.log('   ❌ NO PERMISSIONS RETURNED!');
    }

    // Alternative query - check role_permissions directly
    console.log('\n\nStep 4: Check role_permissions table directly');
    const [rolePerm] = await pool.query(`
      SELECT rp.id, rp.role_id, rp.permission_id, p.code, p.name
      FROM role_permissions rp
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ?
      ORDER BY p.code
    `, [roleId]);

    console.log(`   Found ${rolePerm.length} role_permission records:\n`);
    rolePerm.forEach(rp => {
      console.log(`   ID: ${rp.id}, role_id: ${rp.role_id}, perm_id: ${rp.permission_id}, code: ${rp.code}`);
    });

    // Check if PAYMENT_PROCESS permission exists
    console.log('\n\nStep 5: Check if PAYMENT_PROCESS permission exists');
    const [paymentPerm] = await pool.query(`
      SELECT id, code, name FROM permissions WHERE code = 'PAYMENT_PROCESS'
    `);

    if (paymentPerm.length > 0) {
      console.log(`   ✅ Found: ID=${paymentPerm[0].id}, Code=${paymentPerm[0].code}`);
      
      // Check if this permission is linked to ACC_MGR role
      const [linked] = await pool.query(`
        SELECT * FROM role_permissions 
        WHERE role_id = ? AND permission_id = ?
      `, [roleId, paymentPerm[0].id]);

      if (linked.length > 0) {
        console.log(`   ✅ Linked to role ${roleId}: YES`);
      } else {
        console.log(`   ❌ Linked to role ${roleId}: NO - Need to add link!`);
      }
    } else {
      console.log(`   ❌ Permission not found in database!`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugAuthQuery();
