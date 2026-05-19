const mysql = require('mysql2');
require('dotenv').config({ path: '.env' });

async function addColumn() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 3307,
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_dev'
    };

    try {
        const pool = mysql.createPool(config).promise();
        console.log('Connected to DB');
        
        const [columns] = await pool.query('SHOW COLUMNS FROM sales_order_items LIKE "parent_bom_id"');
        if (columns.length === 0) {
            console.log('Adding column parent_bom_id...');
            await pool.query('ALTER TABLE sales_order_items ADD COLUMN parent_bom_id INT DEFAULT NULL');
            console.log('Column parent_bom_id added successfully');
        } else {
            console.log('Column parent_bom_id already exists');
        }
        await pool.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

addColumn();
