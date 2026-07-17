const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config({ path: './.env' });

async function restoreDatabase() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3307'),
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_prod',
        multipleStatements: true // Enable multiple statements!
    };

    console.log('Connecting to database...');
    const connection = await mysql.createConnection(config);

    try {
        console.log('Reading spTech_prod_backup.sql...');
        const sql = fs.readFileSync('spTech_prod_backup.sql', 'utf8');

        console.log('Restoring backup (this may take a few seconds)...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query(sql);
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('Database restored successfully!');
    } catch (error) {
        console.error('Error restoring database:', error);
    } finally {
        await connection.end();
    }
}

restoreDatabase();
