const mysql = require('mysql2/promise');
require('dotenv').config();
const customerPoService = require('./src/services/customerPoService');

// Mocking pool since it's imported in the service
// Actually, the service already imports the real pool.
// So I just need to call it.

async function testList() {
    try {
        const rows = await customerPoService.listCustomerPos();
        console.log('Customer POs rows count:', rows.length);
        if (rows.length > 0) {
            console.log('First row keys:', Object.keys(rows[0]));
            console.log('First row company_email:', rows[0].company_email);
            console.log('First row details:', JSON.stringify(rows[0], null, 2));
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

testList();
