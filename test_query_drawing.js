const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function run() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const c = await mysql.createConnection(config);
    const [rows] = await c.query("SELECT * FROM sales_order_items WHERE drawing_no LIKE '%1B770200223%' OR item_code LIKE '%1B770200223%'");
    console.log(rows);
    await c.end();
}
run();
