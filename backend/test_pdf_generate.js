const salesInvoiceService = require('./src/services/salesInvoiceService');
const fs = require('fs');

async function testPdf() {
  try {
    const invId = 17;
    console.log('Generating PDF for invoice ID:', invId);
    const pdfBuffer = await salesInvoiceService.generateSalesInvoicePDF(invId);
    fs.writeFileSync('C:/Users/DELL/.gemini/antigravity-ide/brain/fea560ba-8a79-4a64-adf8-1d9bec25b336/scratch/inv17.pdf', pdfBuffer);
    const pageMatches = (pdfBuffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log('SUCCESS! PDF generated. Bytes:', pdfBuffer.length, 'Page count:', pageMatches);
  } catch (err) {
    console.error('Error generating PDF:', err);
  } finally {
    process.exit(0);
  }
}

testPdf();
