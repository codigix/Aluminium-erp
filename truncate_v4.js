const path = require('path');
const mysql = require(path.resolve(__dirname, 'backend/node_modules/mysql2/promise'));
const dotenv = require(path.resolve(__dirname, 'backend/node_modules/dotenv'));

dotenv.config({ path: path.resolve(__dirname, 'backend/.env') });

async function truncateAllTables() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3307),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        multipleStatements: true
    };

    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('Connected to database directly. Starting truncation...');

        // 1. Disable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        // 2. Get all tables
        const [tables] = await connection.query('SHOW TABLES');
        const tableKey = `Tables_in_${config.database}`;

        const skipTables = ['departments', 'roles', 'permissions', 'role_permissions', 'users'];

        for (const tableRow of tables) {
            const tableName = tableRow[tableKey];
            
            if (skipTables.includes(tableName)) {
                console.log(`Skipping core table: ${tableName}`);
                continue;
            }

            console.log(`Truncating table: ${tableName}`);
            await connection.query(`TRUNCATE TABLE \`${tableName}\``);
        }

        // 3. Enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('All non-core tables truncated successfully.');

    } catch (error) {
        console.error('Error during truncation:', error);
        if (connection) {
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        }
    } finally {
        if (connection) {
            await connection.end();
        }
        process.exit(0);
    }
}

truncateAllTables();
