const mysql = require('mysql2');
require('dotenv').config();

async function checkCustomerPos() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = mysql.createConnection(config).promise();

    try {
        const [columns] = await connection.query('SHOW COLUMNS FROM customer_pos');
        console.log('Columns of customer_pos:');
        console.table(columns.map(c => ({ Field: c.Field, Type: c.Type })));

        const [pos] = await connection.query('SELECT * FROM customer_pos LIMIT 10');
        console.log('Customer POs:');
        console.table(pos);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkCustomerPos();
