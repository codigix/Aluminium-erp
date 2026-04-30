const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function truncateProjectRequests() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const [tables] = await connection.query('SHOW TABLES');
        console.log('Available tables:', tables);
        
        console.log('Starting truncation of project_requests table...');
        
        // Disable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        console.log('Truncating table: project_requests');
        await connection.query('TRUNCATE TABLE project_requests');

        // Enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('Successfully truncated project_requests table.');
    } catch (error) {
        console.error('Error during truncation:', error);
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        await connection.end();
    }
}

truncateProjectRequests();
