const pool = require('./backend/src/config/db');

async function truncateAllTables() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to database. Starting truncation...');

        // 1. Disable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        // 2. Get all tables
        const [tables] = await connection.query('SHOW TABLES');
        const dbName = process.env.DB_NAME || 'sales_erp';
        const tableKey = `Tables_in_${dbName}`;

        for (const tableRow of tables) {
            const tableName = tableRow[tableKey];
            
            // Skip core role and permission tables
            const skipTables = ['departments', 'roles', 'permissions', 'role_permissions', 'users'];
            if (skipTables.includes(tableName)) {
                console.log(`Skipping core table: ${tableName}`);
                continue;
            }

            console.log(`Truncating table: ${tableName}`);
            await connection.query(`TRUNCATE TABLE \`${tableName}\``);
        }

        // 3. Enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('All tables truncated successfully.');

        process.exit(0);
    } catch (error) {
        console.error('Error during truncation:', error);
        if (connection) {
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        }
        process.exit(1);
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

truncateAllTables();
