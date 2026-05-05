const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function describeTables() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    };

    const connection = await mysql.createConnection(config);

    try {
        const tables = ['procurement_rfqs', 'purchase_orders', 'grns', 'vendors'];
        for (const table of tables) {
            try {
                const [cols] = await connection.query(`DESCRIBE ${table}`);
                console.log(`\nTable: ${table}`);
                console.table(cols.map(c => ({ Field: c.Field, Type: c.Type })));
            } catch (e) {
                console.log(`Table ${table} not found or error:`, e.message);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

describeTables();
