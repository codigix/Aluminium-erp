const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkRolePerms() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    const [rows] = await connection.query(`
      SELECT p.code FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = 8
    `);
    console.log('DB Permissions for role 8 (INV_MGR):');
    console.log(rows.map(r => r.code).join(','));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkRolePerms();
