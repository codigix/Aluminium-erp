const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const mustache = require('mustache');
const pool = require('../config/db');

async function getHostCompanyForPO(poIdentifier) {
  if (!poIdentifier) return null;
  try {
    let poNum = String(poIdentifier).trim();
    if (poNum.includes(' - ')) {
      poNum = poNum.split(' - ')[0].trim();
    }
    
    let query = '';
    let params = [];
    if (typeof poNum === 'number' || (!isNaN(Number(poNum)) && poNum !== '')) {
      query = `
        SELECT q.host_company_id 
        FROM purchase_orders po
        JOIN quotations q ON po.quotation_id = q.id
        WHERE po.id = ?
      `;
      params = [Number(poNum)];
    } else {
      query = `
        SELECT q.host_company_id 
        FROM purchase_orders po
        JOIN quotations q ON po.quotation_id = q.id
        WHERE po.po_number = ?
      `;
      params = [poNum];
    }
    const [rows] = await pool.query(query, params);
    return rows[0]?.host_company_id || null;
  } catch (err) {
    console.error('[getHostCompanyForPO] Error:', err.message);
    return null;
  }
}

const generatePoPdf = async (data) => {
  const { type = 'receipt', receipt, po, grn, items = [] } = data;
  
  try {
    const templatePath = path.join(__dirname, '../../templates/po-receipt.html');
    const template = fs.readFileSync(templatePath, 'utf8');

    const formatCurrency = (value) => {
      if (!value) return '0.00';
      return parseFloat(value).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };

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
    
    let hostCompanyId = null;
    if (type === 'grn' && grn) {
      hostCompanyId = await getHostCompanyForPO(grn.po_number || grn.poNumber);
    } else if (type === 'receipt' && receipt) {
      hostCompanyId = await getHostCompanyForPO(receipt.po_id || receipt.po_number);
    } else if (type === 'po' && po) {
      hostCompanyId = await getHostCompanyForPO(po.id || po.po_number);
    }

    let activeCompany = null;
    if (hostCompanyId) {
      try {
        activeCompany = await adminCompanyMasterService.getCompanyById(hostCompanyId);
      } catch (err) {
        console.error(`[generatePoPdf] Error loading company profile for hostCompanyId ${hostCompanyId}:`, err.message);
      }
    }

    if (!activeCompany) {
      activeCompany = await adminCompanyMasterService.getActiveCompany();
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
    const hostCompanyAddress = activeCompany?.company_address || 'Industrial Area, Sector 5, Pune, Maharashtra - 411026';
    const hostCompanyAddressLines = hostCompanyAddress ? hostCompanyAddress.split('\n') : ['Industrial Area, Sector 5,', 'Pune, Maharashtra - 411026'];

    let renderData = {
      logoBase64,
      hostCompanyName,
      hostCompanyAddress,
      hostCompanyAddressLines,
      isReceipt: type === 'receipt',
      isPO: type === 'po',
      isGRN: type === 'grn',
      items: items.map((item, idx) => {
        const dQty = parseFloat(item.design_qty);
        const qty = parseFloat(item.quantity || item.po_qty || 0);
        const displayQty = (dQty && dQty !== 0) ? dQty : qty;

        const itemCode = item.item_code || item.itemCode || '';
        const rawDrawingNo = item.drawing_no || item.drawingNo || '';
        
        // Hide drawing no if it matches item code OR if it's a technical item code pattern (RM-, OTH-, etc.)
        const isItemCodePattern = /^(RM-|OTH-|SFG-|FG-|GEN-|CAT-)/i.test(rawDrawingNo);
        const cleanDrawingNo = (rawDrawingNo && rawDrawingNo !== itemCode && !isItemCodePattern && rawDrawingNo !== '—') ? rawDrawingNo : null;

        return {
          sr: idx + 1,
          itemCode: itemCode || '—',
          description: item.description || '—',
          materialName: item.material_name || item.materialName || '',
          drawingNo: cleanDrawingNo,
          qty: `${displayQty.toFixed(3)} ${item.unit || item.uom || ''}`.trim(),
          receivedQty: parseFloat(item.received_quantity || item.accepted_qty || 0).toFixed(3),
          rate: formatCurrency(item.unit_rate || item.rate || 0),
          amount: formatCurrency(item.amount || (displayQty * parseFloat(item.unit_rate || item.rate || 0)))
        };
      })
    };

    if (type === 'grn' && grn) {
      const totalAmount = items.reduce((sum, item) => {
        const qty = parseFloat(item.accepted_qty || 0);
        const rate = parseFloat(item.unit_rate || item.rate || 0);
        return sum + (qty * rate);
      }, 0);

      renderData = {
        ...renderData,
        poNumber: grn.poNumber || grn.po_number || '—',
        poDate: formatDate(grn.createdAt || grn.created_at),
        receiptId: `GRN-${String(grn.id).padStart(4, '0')}`,
        receiptDate: formatDate(grn.grnDate || grn.grn_date),
        refNo: grn.poNumber || grn.po_number || '—',
        vendorName: grn.vendorName || grn.vendor_name || '—',
        notes: grn.notes || '',
        subTotal: formatCurrency(totalAmount),
        grandTotal: formatCurrency(totalAmount)
      };
    } else if (type === 'receipt' && receipt) {
      renderData = {
        ...renderData,
        poNumber: receipt.po_number || '—',
        poDate: formatDate(receipt.created_at),
        receiptId: `REC-${receipt.id}`,
        receiptDate: formatDate(receipt.receipt_date),
        refNo: receipt.po_number || '—',
        vendorName: receipt.vendor_name || '—',
        vendorAddress: '',
        vendorGST: '',
        vendorPhone: '',
        supplierCode: '',
        quotationRef: receipt.po_number || '—',
        paymentTerms: '',
        deliveryDate: '—',
        transport: 'inclusive',
        notes: receipt.notes || '',
        subTotal: formatCurrency(receipt.total_amount || 0),
        cgstAmount: '',
        cgstPercent: 0,
        sgstAmount: '',
        sgstPercent: 0,
        igstAmount: '',
        igstPercent: 0,
        grandTotal: formatCurrency(receipt.total_amount || 0)
      };
    } else if (type === 'po' && po) {
      const subTotal = po.total_amount || 0;
      renderData = {
        ...renderData,
        poNumber: po.po_number || '—',
        poDate: formatDate(po.created_at),
        vendorName: po.vendor_name || '—',
        vendorAddress: '',
        vendorGST: '',
        vendorPhone: '',
        supplierCode: '',
        quotationRef: po.po_number || '—',
        paymentTerms: po.notes || '',
        deliveryDate: formatDate(po.expected_delivery_date),
        transport: 'inclusive',
        notes: po.notes || '',
        subTotal: formatCurrency(subTotal),
        cgstAmount: formatCurrency(0),
        cgstPercent: 9,
        sgstAmount: formatCurrency(0),
        sgstPercent: 9,
        igstAmount: '',
        igstPercent: 0,
        grandTotal: formatCurrency(subTotal)
      };
    }

    const html = mustache.render(template, renderData);

    const outputDir = path.join(__dirname, '../../pdf');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const pdfFileName = type === 'grn'
      ? `GRN_${grn?.id || Date.now()}.pdf`
      : type === 'receipt' 
      ? `PO_Receipt_${receipt?.id || Date.now()}.pdf`
      : `PO_${po?.po_number || Date.now()}.pdf`;

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
        top: '15mm',
        bottom: '15mm',
        left: '10mm',
        right: '10mm'
      }
    });

    await browser.close();

    return pdfPath;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw error;
  }
};

module.exports = generatePoPdf;
