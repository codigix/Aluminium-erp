const customerPaymentService = require('../src/services/customerPaymentService');

async function testOutstandingInvoices() {
    try {
        console.log('Fetching all outstanding invoices...');
        const invoices = await customerPaymentService.getAllOutstandingInvoices();
        console.log(`Fetched ${invoices.length} invoices:`);
        console.log(JSON.stringify(invoices.map(inv => ({ id: inv.id, so_number: inv.so_number, company_name: inv.company_name, outstanding: inv.outstanding, source: inv.source })), null, 2));

        console.log('Fetching payments received list...');
        const payments = await customerPaymentService.getPaymentsReceived();
        console.log(`Fetched ${payments.length} payments.`);

    } catch (error) {
        console.error('Test Failed with Error:', error);
    } finally {
        process.exit(0);
    }
}

testOutstandingInvoices();
