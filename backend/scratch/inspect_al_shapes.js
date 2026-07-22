const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'e:/codigix-project/Aluminium-erp/backend/.env' });

async function inspectShapes() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Querying shapes...');
        const [shapes] = await connection.query('SELECT * FROM shapes');
        console.log('Shapes:', shapes);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

inspectShapes();
