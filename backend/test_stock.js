const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });
const stockService = require('./src/services/stockService');

async function testGetStockBalance() {
    try {
        console.log('--- Testing getStockBalance(null, true) ---');
        const items = await stockService.getStockBalance(null, true);
        console.log(`Total items returned: ${items.length}`);
        if (items.length > 0) {
            console.log('Last item:', items[0]);
        }

        // Check if there are any items in stock_balance that are NOT in the result
        const config = {
            host: process.env.DB_HOST || '127.0.0.1',
            port: process.env.DB_PORT || 3307,
            user: process.env.DB_USER || 'aluminium_user',
            password: process.env.DB_PASSWORD || 'C0digix$309',
            database: process.env.DB_NAME || 'sales_erp'
        };
        const connection = await mysql.createConnection(config);
        const [allRaw] = await connection.query('SELECT DISTINCT item_code FROM stock_balance');
        console.log(`Total unique item_codes in stock_balance: ${allRaw.length}`);

        const resultCodes = new Set(items.map(i => i.item_code));
        const missing = allRaw.filter(r => !resultCodes.has(r.item_code));

        if (missing.length > 0) {
            console.log(`Missing items in result: ${missing.length}`);
            console.log('First 5 missing:', missing.slice(0, 5));
            
            // Debug one missing item
            const code = missing[0].item_code;
            const [details] = await connection.query('SELECT * FROM stock_balance WHERE item_code = ?', [code]);
            console.log(`Details for missing item ${code}:`, details);
        } else {
            console.log('No items missing!');
        }

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

testGetStockBalance();
