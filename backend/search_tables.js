const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function searchTables() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const [tables] = await connection.query('SHOW TABLES');
        const list = tables.map(t => Object.values(t)[0]);
        console.log('All tables:', list);
        
        const projectTables = list.filter(t => t.toLowerCase().includes('project'));
        console.log('Tables containing "project":', projectTables);
        
        const requestTables = list.filter(t => t.toLowerCase().includes('request'));
        console.log('Tables containing "request":', requestTables);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

searchTables();
