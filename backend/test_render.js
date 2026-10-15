const puppeteer = require('puppeteer');
const fs = require('fs');
const salesInvoiceService = require('./src/services/salesInvoiceService');

async function testRender() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set viewport to A4 dimensions at 96 DPI: 794 x 1123, or 2x: 1588 x 2246
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

  // Let's generate HTML for invoice 19 using modified templates to see what looks best
  // First, let's test calling the actual current generateSalesInvoicePDF to inspect the PDF
  const pdfBuffer = await salesInvoiceService.generateSalesInvoicePDF(19);
  fs.writeFileSync('C:/Users/DELL/.gemini/antigravity-ide/brain/fea560ba-8a79-4a64-adf8-1d9bec25b336/scratch/inv19_current.pdf', pdfBuffer);

  console.log('Current PDF saved.');
  await browser.close();
  process.exit(0);
}

testRender().catch(e => { console.error(e); process.exit(1); });
