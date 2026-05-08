const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function truncateAllTransactionalTables() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: process.env.DB_PORT || 3307
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Starting full transactional truncation...');
        
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        const keepTables = [
            'departments', 'roles', 'users', 'permissions', 'role_permissions', 
            'item_groups', 'warehouses', 'workstations', 'companies', 
            'company_addresses', 'contacts', 'vendors', 'materials', 
            'shapes', 'operation_workstations', 'operations'
        ];

        const [tables] = await connection.query('SHOW TABLES');
        const dbName = config.database;
        const key = `Tables_in_${dbName}`;

        for (const tableRow of tables) {
            const tableName = tableRow[key];
            if (!keepTables.includes(tableName)) {
                console.log(`Truncating table: ${tableName}`);
                await connection.query(`TRUNCATE TABLE ${tableName}`);
            }
        }

        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Successfully truncated all transactional tables.');
    } catch (error) {
        console.error('Error during truncation:', error);
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        await connection.end();
    }
}

truncateAllTransactionalTables();
