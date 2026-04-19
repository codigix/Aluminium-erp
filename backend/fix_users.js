const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function fixUsers() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const users = [
        { username: 'admin', email: 'admin@company.com', password: 'Admin@123', dept: 9, role: 9 },
        { username: 'sales', email: 'sales@company.com', password: 'Sales@123', dept: 1, role: 1 },
        { username: 'design', email: 'design@company.com', password: 'Design@123', dept: 2, role: 2 },
        { username: 'procurement', email: 'procurement@company.com', password: 'Procurement@123', dept: 3, role: 3 },
        { username: 'production', email: 'production@company.com', password: 'Production@123', dept: 4, role: 4 },
        { username: 'quality', email: 'quality@company.com', password: 'Quality@123', dept: 5, role: 5 },
        { username: 'shipment', email: 'shipment@company.com', password: 'Shipment@123', dept: 6, role: 6 },
        { username: 'accounts', email: 'accounts@company.com', password: 'Accounts@123', dept: 7, role: 7 },
        { username: 'inventory', email: 'inventory@company.com', password: 'Inventory@123', dept: 8, role: 8 }
    ];

    try {
        const connection = await mysql.createConnection(config);
        console.log('Connected to database');

        for (const user of users) {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            
            // Check if user exists by email
            const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [user.email]);
            
            if (existing.length > 0) {
                console.log(`Updating user: ${user.email}`);
                await connection.query(
                    'UPDATE users SET username = ?, password = ?, department_id = ?, role_id = ?, status = "ACTIVE" WHERE email = ?',
                    [user.username, hashedPassword, user.dept, user.role, user.email]
                );
            } else {
                console.log(`Creating user: ${user.email}`);
                await connection.query(
                    'INSERT INTO users (username, email, password, department_id, role_id, status, first_name, last_name) VALUES (?, ?, ?, ?, ?, "ACTIVE", ?, "")',
                    [user.username, user.email, hashedPassword, user.dept, user.role, user.username.charAt(0).toUpperCase() + user.username.slice(1)]
                );
            }
        }
        
        console.log('All users updated successfully');
        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

fixUsers();
