const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkData() {
    const config = {
        host: '127.0.0.1',
        user: 'root',
        password: '',
        database: 'sales_erp',
        port: 3306
    };

    console.log('Connecting to:', config.host, config.port, config.database);
    
    try {
        const connection = await mysql.createConnection(config);
        console.log('Connected!');

        const [orders] = await connection.query('SELECT count(*) as count FROM orders');
        console.log('Orders:', orders[0].count);

        const [sos] = await connection.query('SELECT count(*) as count FROM sales_orders');
        console.log('Sales Orders:', sos[0].count);

        const [qrs] = await connection.query('SELECT count(*) as count FROM quotation_requests');
        console.log('Quotation Requests:', qrs[0].count);

        const [pos] = await connection.query('SELECT count(*) as count FROM customer_pos');
        console.log('Customer POs:', pos[0].count);

        const [items] = await connection.query('SELECT count(*) as count FROM order_items');
        console.log('Order Items:', items[0].count);

        const [soi] = await connection.query('SELECT count(*) as count FROM sales_order_items');
        console.log('Sales Order Items:', soi[0].count);

        const [plans] = await connection.query('SELECT count(*) as count FROM production_plans');
        console.log('Production Plans:', plans[0].count);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkData();
