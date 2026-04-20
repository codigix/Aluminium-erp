const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function checkOperations() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('--- Production Plan Operations ---');
        const [ops] = await connection.query(`
            SELECT id, plan_id, step_no, operation_name, source_item, item_type 
            FROM production_plan_operations
        `);
        console.table(ops);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkOperations();
