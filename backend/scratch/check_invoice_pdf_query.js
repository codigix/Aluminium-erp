const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const paymentService = require('../src/services/paymentService');

async function testPdf() {
    try {
        console.log('Testing generateVendorInvoicePDF for ID 189...');
        const buffer = await paymentService.generateVendorInvoicePDF(189, 'SUBCONTRACTING');
        console.log('Success! Buffer length:', buffer.length);
    } catch (err) {
        console.error('Error occurred:', err);
    }
}

testPdf();
