const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function checkTables() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log(`Checking database: ${config.database} on ${config.host}:${config.port}`);
        
        const [tables] = await connection.query('SHOW TABLES');
        const tableKey = `Tables_in_${config.database}`;

        for (const tableRow of tables) {
            const tableName = tableRow[tableKey];
            const [countResult] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
            const count = countResult[0].count;
            if (count > 0) {
                console.log(`Table: ${tableName} - Count: ${count}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkTables();
