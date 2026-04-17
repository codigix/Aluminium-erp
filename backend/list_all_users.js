const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function listUsers() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    const [users] = await connection.query("SELECT u.id, u.username, u.first_name, u.last_name, r.code as role_code, d.code as dept_code FROM users u JOIN roles r ON u.role_id = r.id JOIN departments d ON u.department_id = d.id");
    console.table(users);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

listUsers();
