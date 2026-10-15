const puppeteer = require('puppeteer');
const fs = require('fs');
const pool = require('./src/config/db');
const Mustache = require('mustache');

async function testVariations() {
  const [invRows] = await pool.query(`
    SELECT 
      si.*,
      o.order_no,
      o.order_date,
      o.source_type,
      o.quotation_id,
      c.company_name AS client_name,
      c.company_code,
      c.gstin AS company_gstin,
      c.pan AS company_pan,
      cp.po_number,
      cp.po_date
    FROM sales_invoices si
    JOIN orders o ON o.id = si.order_id
    JOIN companies c ON c.id = si.client_id
    LEFT JOIN customer_pos cp ON cp.id = o.quotation_id AND o.source_type = 'DIRECT'
    WHERE si.id = 19
  `);
  const invoice = invRows[0];
  const [items] = await pool.query('SELECT * FROM sales_invoice_items WHERE sales_invoice_id = 19 ORDER BY id ASC');

  // Let's inspect the items length
  console.log('Items count:', items.length);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  // Function to render HTML to PDF and screenshot
  async function testHtml(html, label) {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pageMatches = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    
    // screenshot
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    const shot = await page.screenshot({ fullPage: true });
    fs.writeFileSync(`C:/Users/DELL/.gemini/antigravity-ide/brain/fea560ba-8a79-4a64-adf8-1d9bec25b336/scratch/${label}.png`, shot);
    fs.writeFileSync(`C:/Users/DELL/.gemini/antigravity-ide/brain/fea560ba-8a79-4a64-adf8-1d9bec25b336/scratch/${label}.pdf`, pdf);
    
    console.log(`[${label}] Pages: ${pageMatches}`);
    await page.close();
  }

  // Let's test with different styles
  // We can load the exact template from salesInvoiceService.js
  const serviceCode = fs.readFileSync('./src/services/salesInvoiceService.js', 'utf8');
  // extract template
  const tmplMatch = serviceCode.match(/const htmlTemplate = `([\s\S]*?)`;\s*return Mustache\.render\(htmlTemplate,/);
  if (!tmplMatch) {
    console.log('Template match failed');
    return;
  }
  const baseTmpl = tmplMatch[1];

  // Helper to get data object
  const salesInvoiceService = require('./src/services/salesInvoiceService');
  // Let's get the rendered html using a small trick or replicating the data mapping
  // Since salesInvoiceService.generateSalesInvoicePDF is exported, let's see how it builds the data:
  // We can test variations by modifying the CSS in baseTmpl
  console.log('Template found, testing CSS modifications...');
  
  await browser.close();
  process.exit(0);
}

testVariations().catch(e => { console.error(e); process.exit(1); });
