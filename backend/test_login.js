const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function testLogin() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const email = 'admin@company.com';
    const password = 'Admin@123';

    try {
        const connection = await mysql.createConnection(config);
        console.log('Connected to database');

        const [results] = await connection.query('SELECT * FROM users WHERE email = ? AND status = "ACTIVE"', [email]);

        if (results.length === 0) {
            console.log('User not found');
            await connection.end();
            return;
        }

        const user = results[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            console.log('Login SUCCESSFUL for', email);
        } else {
            console.log('Login FAILED: Password mismatch');
        }

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

testLogin();
