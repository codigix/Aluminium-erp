const customerPoService = require('./src/services/customerPoService');

async function test() {
  try {
    const poId = 5;
    console.log(`Testing Customer PO PDF generation for PO ID: ${poId}`);
    const pdfBuffer = await customerPoService.generateCustomerPoPDF(poId);
    console.log('PDF generated successfully! Buffer length:', pdfBuffer.length);
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
  process.exit(0);
}

test();
