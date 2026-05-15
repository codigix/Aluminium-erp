const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('--- Current Users ---');
  const [users] = await connection.query('SELECT id, username, email, department_id, role_id, status FROM users');
  console.log(JSON.stringify(users, null, 2));

  console.log('\n--- Current Roles ---');
  const [roles] = await connection.query('SELECT * FROM roles');
  console.log(JSON.stringify(roles, null, 2));

  console.log('\n--- Role Permissions Count ---');
  for (const role of roles) {
    const [rp] = await connection.query('SELECT COUNT(*) as count FROM role_permissions WHERE role_id = ?', [role.id]);
    console.log(`Role: ${role.name} (${role.code}), Permissions: ${rp[0].count}`);
  }

  await connection.end();
}

main().catch(console.error);
