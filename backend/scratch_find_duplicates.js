const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function find() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_dev',
        port: parseInt(process.env.DB_PORT || '3307')
    };

    const connection = await mysql.createConnection(config);

    try {
        const [rows] = await connection.query(`
            SELECT LOWER(TRIM(material_name)) as norm_name, 
                   COUNT(DISTINCT item_code) as code_count, 
                   GROUP_CONCAT(DISTINCT item_code ORDER BY item_code) as codes
            FROM stock_balance 
            WHERE material_name IS NOT NULL AND material_name != ''
            GROUP BY LOWER(TRIM(material_name))
            HAVING code_count > 1
        `);
        
        console.log('=== Duplicate Material Groups ===');
        console.log(JSON.stringify(rows, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

find();
