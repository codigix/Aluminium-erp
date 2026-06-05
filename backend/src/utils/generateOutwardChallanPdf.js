const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const mustache = require('mustache');
const pool = require('../config/db');

const generateOutwardChallanPdf = async (challan) => {
  try {
    const templatePath = path.join(__dirname, '../../templates/outward-challan.html');
    const template = fs.readFileSync(templatePath, 'utf8');

    const formatDate = (date) => {
      if (!date) return '—';
      try {
        return new Date(date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch {
        return date;
      }
    };

    const adminCompanyMasterService = require('../services/adminCompanyMasterService');
    let activeCompany = null;
    try {
      activeCompany = await adminCompanyMasterService.getActiveCompany();
    } catch (err) {
      console.error(`[generateOutwardChallanPdf] Error loading company profile:`, err.message);
    }

    let logoBase64 = null;
    if (activeCompany && activeCompany.company_logo) {
      const uploadedLogoPath = path.join(__dirname, '../../', activeCompany.company_logo);
      if (fs.existsSync(uploadedLogoPath)) {
        logoBase64 = `data:image/png;base64,${fs.readFileSync(uploadedLogoPath).toString('base64')}`;
      }
    }

    if (!logoBase64) {
      const logoPath = path.join(__dirname, '../../../frontend/src/assets/sptechpioneer logo.png');
      logoBase64 = fs.existsSync(logoPath) 
        ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
        : null;
    }

    const hostCompanyName = activeCompany?.company_name || 'SP TECHPIONEER PVT. LTD.';
    const hostCompanyAddress = activeCompany?.company_address || 'Plot No. 97, Sector 7, PCNTDA, Bhosari, Pune – 411026';

    const [dbStockBalances] = await pool.query(`SELECT item_code, material_name, item_description FROM stock_balance`);
    const [dbItems] = await pool.query(`SELECT item_code, description FROM items`);

    const getItemDescription = (itemCode) => {
      const matchSb = dbStockBalances.find(i => i.item_code === itemCode);
      if (matchSb && (matchSb.material_name || matchSb.item_description)) {
        return matchSb.material_name || matchSb.item_description;
      }
      const matchItem = dbItems.find(i => i.item_code === itemCode);
      if (matchItem && matchItem.description) {
        return matchItem.description;
      }
      return '—';
    };

    const renderData = {
      logoBase64,
      hostCompanyName,
      hostCompanyAddress,
      challanNo: challan.challan_number,
      challanDate: formatDate(challan.dispatch_date),
      jobCardNo: challan.job_card_no,
      workOrderNo: challan.wo_number || '—',
      vendorName: challan.vendor_name,
      vendorCode: challan.vendor_code || '—',
      operationName: challan.operation_name,
      expectedReturnDate: formatDate(challan.expected_return_date),
      dispatchQty: parseFloat(challan.dispatch_qty || 0).toFixed(3),
      status: challan.status,
      notes: challan.notes,
      items: (challan.items || []).map((item, idx) => ({
        sr: idx + 1,
        itemCode: item.item_code,
        description: getItemDescription(item.item_code),
        requiredQty: parseFloat(item.required_qty || 0).toFixed(3),
        releaseQty: parseFloat(item.release_qty || 0).toFixed(3)
      }))
    };

    const html = mustache.render(template, renderData);

    const outputDir = path.join(__dirname, '../../pdf');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const pdfFileName = `Outward_Challan_${challan.id || Date.now()}.pdf`;
    const pdfPath = path.join(outputDir, pdfFileName);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm'
      }
    });

    await browser.close();

    return pdfPath;
  } catch (error) {
    console.error('Outward PDF Generation Error:', error);
    throw error;
  }
};

module.exports = generateOutwardChallanPdf;
