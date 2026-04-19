const mysql = require('mysql2/promise');
require('dotenv').config();

async function listDeptsAndRoles() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    try {
        const connection = await mysql.createConnection(config);
        console.log('Connected to database');
        
        const [depts] = await connection.query('SELECT id, name, code FROM departments');
        console.log('Departments:', depts);
        
        const [roles] = await connection.query('SELECT id, name, code, department_id FROM roles');
        console.log('Roles:', roles);
        
        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

listDeptsAndRoles();
