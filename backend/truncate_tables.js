const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function truncateAllTables() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3307'),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_prod'
    };

    console.log('Connecting to database with config:', {
        host: config.host,
        port: config.port,
        user: config.user,
        database: config.database
    });

    const connection = await mysql.createConnection(config);

    try {
        console.log('Starting database truncation...');
        
        // 1. Disable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        // 2. Get all tables in the database
        const [tables] = await connection.query('SHOW TABLES');
        const tableKey = `Tables_in_${config.database}`;

        for (const tableRow of tables) {
            const tableName = tableRow[tableKey];
            
            // Skip master tables if they shouldn't be cleared (uncomment below if needed)
            // const skipTables = ['departments', 'roles', 'permissions', 'role_permissions', 'users'];
            // if (skipTables.includes(tableName)) continue;

            console.log(`Truncating table: ${tableName}`);
            await connection.query(`TRUNCATE TABLE \`${tableName}\``);
        }

        // 3. Enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('Successfully truncated all tables.');
    } catch (error) {
        console.error('Error during truncation:', error);
        try {
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        } catch (e) {}
    } finally {
        await connection.end();
    }
}

truncateAllTables();
