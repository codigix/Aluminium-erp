const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkData() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);
    try {
        const [wo] = await connection.query('SELECT * FROM work_orders WHERE wo_number = ?', ['WO-00011-987']);
        console.log('Work Order:', JSON.stringify(wo, null, 2));
        
        if (wo.length > 0 && wo[0].parent_wo_id) {
            const [parent] = await connection.query('SELECT * FROM work_orders WHERE id = ?', [wo[0].parent_wo_id]);
            console.log('Parent Work Order:', JSON.stringify(parent, null, 2));
        }
    } catch (error) {
        console.error(error);
    } finally {
        await connection.end();
    }
}

checkData();
