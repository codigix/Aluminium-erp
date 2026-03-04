const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkSchema() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    try {
        const [rows] = await connection.query('DESCRIBE sales_order_item_materials');
        console.log('sales_order_item_materials schema:');
        console.table(rows);
        
        const [compRows] = await connection.query('DESCRIBE sales_order_item_components');
        console.log('sales_order_item_components schema:');
        console.table(compRows);
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

checkSchema();
