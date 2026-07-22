const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'e:/codigix-project/Aluminium-erp/backend/.env' });

async function inspectGrn() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Querying purchase_order_items for ID 192 and 193...');
        const [poItems] = await connection.query("SELECT * FROM purchase_order_items WHERE id IN (192, 193)");
        console.log('PO Items:', poItems);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

inspectGrn();
