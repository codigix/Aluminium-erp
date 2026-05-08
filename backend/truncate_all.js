const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function truncateAllTables() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log(`Starting database truncation on: ${config.database}`);
        
        // 1. Disable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        // 2. Get all tables in the database
        const [tables] = await connection.query('SHOW TABLES');
        const tableKey = `Tables_in_${config.database}`;

        // Tables to SKIP (Master data)
        const skipTables = [
            'departments', 'roles', 'permissions', 'role_permissions', 'users',
            'companies', 'company_addresses', 'contacts', 'vendors',
            'item_groups', 'items', 'materials', 'workstations', 'operation_workstations',
            'operations', 'shapes'
        ];

        for (const tableRow of tables) {
            const tableName = tableRow[tableKey];
            
            if (skipTables.includes(tableName)) {
                console.log(`Skipping master table: ${tableName}`);
                continue;
            }

            console.log(`Truncating table: ${tableName}`);
            await connection.query(`TRUNCATE TABLE \`${tableName}\``);
        }

        // 3. Enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('Successfully truncated all transactional tables.');
    } catch (error) {
        console.error('Error during truncation:', error);
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        await connection.end();
    }
}

truncateAllTables();
