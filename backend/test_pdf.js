const purchaseOrderService = require('./src/services/purchaseOrderService');

async function test() {
  try {
    console.log('Testing PDF generation for PO UUID: 2bbe243d-dc62-4e5b-852e-dce97d680cd8');
    const pdfBuffer = await purchaseOrderService.generatePurchaseOrderPDF('2bbe243d-dc62-4e5b-852e-dce97d680cd8');
    console.log('PDF generated successfully! Buffer length:', pdfBuffer.length);
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
  process.exit(0);
}

test();
