const puppeteer = require('puppeteer');
const fs = require('fs');
const pool = require('./src/config/db');

async function testBoth() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Let's test generating invoice 15 with current salesInvoiceService
  const salesInvoiceService = require('./src/services/salesInvoiceService');
  
  console.log('Testing invoice 19 (10 items)...');
  const pdf19 = await salesInvoiceService.generateSalesInvoicePDF(19);
  const count19 = (pdf19.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log('Invoice 19 page count:', count19);

  console.log('Testing invoice 15 (323 items)...');
  const pdf15 = await salesInvoiceService.generateSalesInvoicePDF(15);
  const count15 = (pdf15.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log('Invoice 15 page count:', count15);

  fs.writeFileSync('C:/Users/DELL/.gemini/antigravity-ide/brain/fea560ba-8a79-4a64-adf8-1d9bec25b336/scratch/inv15_before.pdf', pdf15);

  await browser.close();
  process.exit(0);
}

testBoth().catch(e => { console.error(e); process.exit(1); });
