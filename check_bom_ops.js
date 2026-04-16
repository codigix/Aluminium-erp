const mysql = require('mysql2');
require('dotenv').config({ path: './backend/.env' });

async function checkColumns() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3307,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    };

    const connection = await mysql.createConnection(config).promise();

    try {
        const [columns] = await connection.query('DESCRIBE bom_operations');
        console.log('Columns in bom_operations:', JSON.stringify(columns, null, 2));
        
        const [columnsPP] = await connection.query('DESCRIBE production_plan_operations');
        console.log('Columns in production_plan_operations:', JSON.stringify(columnsPP, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkColumns();
