const mysql = require('mysql2/promise');
require('dotenv').config();

async function debug() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    console.log('--- Roles ---');
    const [roles] = await connection.query('SELECT id, name, code FROM roles');
    console.table(roles);

    console.log('--- Permissions for DESIGN_VIEW ---');
    const [perms] = await connection.query('SELECT id, name, code FROM permissions WHERE code = "DESIGN_VIEW"');
    console.table(perms);

    if (perms.length > 0) {
      console.log('--- Roles with DESIGN_VIEW ---');
      const [rolePerms] = await connection.query(`
        SELECT r.name, r.code, p.code as perm_code 
        FROM role_permissions rp
        JOIN roles r ON rp.role_id = r.id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE p.code = "DESIGN_VIEW"
      `);
      console.table(rolePerms);
    }

    console.log('--- Admin User Info ---');
    const [users] = await connection.query(`
      SELECT u.username, u.email, r.code as role_code, u.role_id 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.username = "admin" OR u.email = "admin@company.com"
    `);
    console.table(users);

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

debug();
