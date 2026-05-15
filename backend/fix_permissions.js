const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysql = require('mysql2/promise');

async function fixPermissions() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: process.env.DB_NAME || 'spTech_dev',
    port: Number(process.env.DB_PORT || 3307)
  };

  const connection = await mysql.createConnection(config);
  console.log('Connected to database:', config.database);

  try {
    // 1. Get all roles
    const [roles] = await connection.query('SELECT id, name, code FROM roles');
    console.log(`Found ${roles.length} roles.`);

    // 2. Get all permissions
    const [permissions] = await connection.query('SELECT id, code FROM permissions');
    console.log(`Found ${permissions.length} permissions.`);

    if (permissions.length === 0) {
        console.log('No permissions found in database. Seeding basic permissions first...');
        const perms = ['PO_VIEW', 'PO_CREATE', 'PO_EDIT', 'PO_DELETE', 'ORDER_VIEW', 'ORDER_CREATE', 'ORDER_EDIT', 'COMPANY_VIEW', 'COMPANY_EDIT', 'USER_MANAGE', 'DEPT_MANAGE', 'DASHBOARD_VIEW', 'DATA_EXPORT', 'STATUS_CHANGE', 'PROD_VIEW', 'PROD_MANAGE', 'DESIGN_VIEW', 'DESIGN_MANAGE', 'BOM_VIEW', 'BOM_MANAGE', 'VENDOR_VIEW', 'VENDOR_EDIT', 'GRN_VIEW', 'GRN_CREATE', 'GRN_EDIT', 'GRN_DELETE', 'STOCK_VIEW', 'STOCK_MANAGE', 'PAYMENT_VIEW', 'PAYMENT_PROCESS', 'PAYMENT_EDIT', 'PAYMENT_SETUP'];
        for (const p of perms) {
            await connection.query('INSERT IGNORE INTO permissions (name, code, status) VALUES (?, ?, "ACTIVE")', [p.replace(/_/g, ' '), p]);
        }
        // Refresh permissions list
        const [newPermissions] = await connection.query('SELECT id, code FROM permissions');
        permissions.push(...newPermissions);
        console.log(`Now have ${permissions.length} permissions.`);
    }

    // 3. Grant all permissions to all roles
    console.log('Granting all permissions to all roles...');
    for (const role of roles) {
      console.log(`Processing role: ${role.code}`);
      for (const perm of permissions) {
        await connection.query(
          'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [role.id, perm.id]
        );
      }
    }

    console.log('Successfully granted all permissions to all roles!');
  } catch (error) {
    console.error('Error fixing permissions:', error);
  } finally {
    await connection.end();
  }
}

fixPermissions();
