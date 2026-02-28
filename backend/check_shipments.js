const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3307,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('--- shipment_orders columns ---');
        const [columns] = await connection.query('DESCRIBE shipment_orders');
        console.log(JSON.stringify(columns, null, 2));

        console.log('--- shipment_orders data ---');
        const [data] = await connection.query('SELECT * FROM shipment_orders');
        console.log(JSON.stringify(data, null, 2));

        console.log('--- sales_orders columns ---');
        const [soColumns] = await connection.query('DESCRIBE sales_orders');
        console.log(JSON.stringify(soColumns, null, 2));

        console.log('--- All Sales Orders (all columns) ---');
        const [allOrders] = await connection.query('SELECT * FROM sales_orders');
        console.log(JSON.stringify(allOrders, null, 2));

        console.log('--- All Companies ---');
        const [allCompanies] = await connection.query('SELECT id, company_name FROM companies');
        console.log(JSON.stringify(allCompanies, null, 2));

    } catch (error) {
        console.error(error);
    } finally {
        await connection.end();
    }
})();
