const mysql = require('mysql2');
require('dotenv').config({ path: '.env' });

async function addColumn() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    let connection;
    try {
        const pool = mysql.createPool(config).promise();
        console.log('Connected to DB via pool');
        
        const [columns] = await pool.query('SHOW COLUMNS FROM quotation_requests LIKE "pending_bom_cost"');
        if (columns.length === 0) {
            console.log('Adding column pending_bom_cost...');
            await pool.query('ALTER TABLE quotation_requests ADD COLUMN pending_bom_cost DECIMAL(15, 2) DEFAULT NULL');
            console.log('Column added successfully');
        } else {
            console.log('Column pending_bom_cost already exists');
        }
        await pool.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

addColumn();
