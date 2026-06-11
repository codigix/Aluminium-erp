const customerPoService = require('./src/services/customerPoService');

async function test() {
  try {
    const poId = 5;
    console.log(`Testing standard Customer PO PDF generation for PO ID: ${poId}`);
    const pdfBufferNormal = await customerPoService.generateCustomerPoPDF(poId, null, false, false, false);
    console.log('Standard PDF generated successfully! Buffer length:', pdfBufferNormal.length);

    console.log(`Testing Sent Customer PO PDF generation (dispatched items only) for PO ID: ${poId}`);
    const pdfBufferSent = await customerPoService.generateCustomerPoPDF(poId, null, true, false, true);
    console.log('Sent PO PDF generated successfully! Buffer length:', pdfBufferSent.length);

    console.log(`Testing Balance Dispatch Report PDF generation (pending items only) for PO ID: ${poId}`);
    const pdfBufferBalance = await customerPoService.generateCustomerPoPDF(poId, null, true, true, false);
    console.log('Balance Report PDF generated successfully! Buffer length:', pdfBufferBalance.length);
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
  process.exit(0);
}

test();
