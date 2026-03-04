const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkPerms() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'backend',
    database: process.env.DB_NAME || 'sales_erp'
  });

  try {
    const [columns] = await connection.query('SHOW COLUMNS FROM roles');
    console.log('Roles columns:', columns.map(c => c.Field));
    const [depts] = await connection.query('SELECT * FROM departments');
    console.log('Departments:');
    console.table(depts);
    const [rows] = await connection.query('SELECT u.*, r.code as role_code, d.code as dept_code FROM users u JOIN roles r ON u.role_id = r.id JOIN departments d ON u.department_id = d.id WHERE u.id = 9');
    console.log('Permissions for user 9:');
    console.table(rows);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkPerms();
