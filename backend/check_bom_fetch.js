const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkData() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    };

    const connection = await mysql.createConnection(config);

    try {
        const [dbs] = await connection.query('SHOW DATABASES');
        console.log('Databases:', dbs);
        console.log('Using Database:', config.database);

        const [tables] = await connection.query('SHOW TABLES');
        console.log('Tables:', tables);

        const [rows] = await connection.query('SELECT count(*) as count FROM orders');
        console.log('Orders count:', rows[0].count);
        const [rows2] = await connection.query('SELECT count(*) as count FROM sales_orders');
        console.log('Sales Orders count:', rows2[0].count);
        const [rows3] = await connection.query('SELECT count(*) as count FROM customer_pos');
        console.log('Customer POs count:', rows3[0].count);

        console.log('--- Sales Orders ---');
        const [sos] = await connection.query('SELECT id, project_name FROM sales_orders ORDER BY id DESC LIMIT 5');
        console.log(sos);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkData();
