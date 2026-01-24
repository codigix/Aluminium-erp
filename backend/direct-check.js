require('dotenv').config();
const mysql = require('mysql2/promise');

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    const [roles] = await connection.query("SELECT id, code FROM roles");
    console.log('Roles:', roles);
    
    const [users] = await connection.query("SELECT id, email, role_id FROM users");
    console.log('Users count:', users.length);
    console.log('Users:', users);
    
    const [rpDetail] = await connection.query(`
      SELECT r.code as role_code, p.code as perm_code 
      FROM role_permissions rp 
      JOIN roles r ON rp.role_id = r.id 
      JOIN permissions p ON rp.permission_id = p.id 
      WHERE r.id = 2
    `);
    console.log('Permissions for role 2 (DESIGN_ENG_ROLE):', rpDetail.map(r => r.perm_code));
    
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}
check();
