const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function main() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3307'),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_dev'
    };

    const connection = await mysql.createConnection(config);
    try {
        const [so] = await connection.query("SELECT * FROM sales_orders WHERE public_id = '247ac06e-0e3c-45c4-8e7c-af252ee48873'");
        console.log('sales_order:', so);
        const [dwg] = await connection.query("SELECT * FROM customer_drawings WHERE public_id = 'f3558061-c6a0-4fc8-a7db-c13d827423aa'");
        console.log('customer_drawing:', dwg);
    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}
main();
