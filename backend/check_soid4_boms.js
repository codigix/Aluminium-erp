const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function checkSoid4BOMs() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 3307,
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const ids = [22, 23, 24];
        for (const id of ids) {
            console.log(`--- BOM for SOI ${id} ---`);
            const [materials] = await connection.query(`SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = ?;`, [id]);
            console.log('Materials:', materials.length);
            
            const [components] = await connection.query(`SELECT * FROM sales_order_item_components WHERE sales_order_item_id = ?;`, [id]);
            console.log('Components:', components.length);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkSoid4BOMs();
