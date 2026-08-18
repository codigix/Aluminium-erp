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
    const isGRNOrReceipt = type === 'grn' || type === 'receipt';
    const templateFileName = isGRNOrReceipt ? 'po-receipt-grn.html' : 'po-receipt.html';
    const templatePath = path.join(__dirname, '../../templates/', templateFileName);
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
      if (grn.po_receipt_id || grn.poReceiptId) {
        try {
          const [receiptRows] = await pool.query('SELECT host_company_id FROM po_receipts WHERE id = ?', [grn.po_receipt_id || grn.poReceiptId]);
          if (receiptRows.length > 0 && receiptRows[0].host_company_id) {
            hostCompanyId = receiptRows[0].host_company_id;
          }
        } catch (err) {
          console.error('[generatePoPdf] Error checking po_receipts host_company_id:', err.message);
        }
      }
      if (!hostCompanyId) {
        hostCompanyId = await getHostCompanyForPO(grn.po_number || grn.poNumber);
      }
    } else if (type === 'receipt' && receipt) {
      hostCompanyId = receipt.host_company_id;
      if (!hostCompanyId) {
        hostCompanyId = await getHostCompanyForPO(receipt.po_id || receipt.po_number);
      }
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
    const hasGSTInAddress = hostCompanyAddress.toLowerCase().includes('gstin');
    const hostCompanyGST = hasGSTInAddress ? null : (activeCompany?.gstin || '27AAPCS1193L1ZQ');

    // Resolve PO details dynamically if not provided
    let poDetail = po;
    if (!poDetail) {
      let poIdOrNum = null;
      if (type === 'receipt' && receipt) {
        poIdOrNum = receipt.po_id || receipt.po_number;
      } else if (type === 'grn' && grn) {
        poIdOrNum = grn.po_number || grn.poNumber;
      }

      if (poIdOrNum) {
        try {
          const [poRows] = await pool.query(
            `SELECT po.*, v.vendor_name, v.email as vendor_email, v.phone as vendor_phone, v.location as vendor_address, v.gstin as vendor_gstin
             FROM purchase_orders po
             LEFT JOIN vendors v ON v.id = po.vendor_id
             WHERE po.id = ? OR po.po_number = ?`,
            [poIdOrNum, poIdOrNum]
          );
          if (poRows.length > 0) {
            poDetail = poRows[0];
          }
        } catch (dbErr) {
          console.error('[generatePoPdf] Error querying PO fallback:', dbErr.message);
        }
      }
    }

    // Resolve vendor details
    let vendorName = '—';
    let vendorEmail = '—';
    let vendorPhone = '—';
    let vendorGST = '—';

    if (poDetail) {
      vendorName = poDetail.vendor_name || '—';
      vendorEmail = poDetail.vendor_email || '—';
      vendorPhone = poDetail.vendor_phone || '—';
      vendorGST = poDetail.vendor_gstin || '—';
    } else {
      if (type === 'grn' && grn) {
        vendorName = grn.vendorName || grn.vendor_name || '—';
      } else if (type === 'receipt' && receipt) {
        vendorName = receipt.vendor_name || '—';
      }
    }

    // Map items and calculate totals dynamically
    let subTotalVal = 0;
    let cgstAmountVal = 0;
    let sgstAmountVal = 0;
    let cgstPercentVal = 9;
    let sgstPercentVal = 9;

    const mappedItems = items.map((item, idx) => {
      const isReceiptOrGrn = type === 'receipt' || type === 'grn';
      const receivedQtyVal = parseFloat(item.received_quantity || item.received_qty || item.accepted_qty || 0);
      const displayQty = isReceiptOrGrn ? receivedQtyVal : (parseFloat(item.design_qty) || parseFloat(item.quantity || item.po_qty || 0));

      const itemCode = item.item_code || item.itemCode || '';
      let parentDrawingNo = poDetail?.drawing_no || '';
      if (parentDrawingNo) {
        const isParentDwgPattern = /^(RM-|OTH-|SFG-|FG-|GEN-|CAT-)/i.test(parentDrawingNo);
        if (isParentDwgPattern) {
          parentDrawingNo = '';
        }
      }
      const rawDrawingNo = parentDrawingNo || item.drawing_no || item.drawingNo || '';
      const isItemCodePattern = /^(RM-|OTH-|SFG-|FG-|GEN-|CAT-)/i.test(rawDrawingNo);
      const cleanDrawingNo = (rawDrawingNo && rawDrawingNo !== itemCode && !isItemCodePattern && rawDrawingNo !== '—') ? rawDrawingNo : null;

      const rate = parseFloat(item.unit_rate || item.rate || 0);
      const amountVal = displayQty * rate;
      subTotalVal += amountVal;

      const cgstPercent = parseFloat(item.cgst_percent || item.cgstPercent || 9);
      const sgstPercent = parseFloat(item.sgst_percent || item.sgstPercent || 9);

      if (idx === 0) {
        cgstPercentVal = cgstPercent;
        sgstPercentVal = sgstPercent;
      }

      cgstAmountVal += amountVal * (cgstPercent / 100);
      sgstAmountVal += amountVal * (sgstPercent / 100);

      const uom = item.unit || item.uom || 'Nos';

      const len = parseFloat(item.length || 0);
      const wid = parseFloat(item.width || 0);
      const thk = parseFloat(item.thickness || 0);
      const dia = parseFloat(item.diameter || 0);
      const od = parseFloat(item.outer_diameter || 0);

      let dimsSpec = '';
      if (len > 0 || wid > 0 || thk > 0 || dia > 0 || od > 0) {
        const shapeRaw = (item.shape_type || item.shape_name || item.shape || item.material_name || '').toLowerCase();
        const nf = (v) => { if (!v || isNaN(parseFloat(v)) || parseFloat(v) === 0) return null; const num = parseFloat(v); return num % 1 === 0 ? num.toFixed(0) : num.toFixed(1); };

        let ms = '';
        if (shapeRaw.includes('threaded') || shapeRaw.includes('thread')) ms = 'threaded rod';
        else if (shapeRaw.includes('square tube') || (shapeRaw.includes('square') && shapeRaw.includes('tube'))) ms = 'square tube';
        else if (shapeRaw.includes('rectangular tube') || shapeRaw.includes('rect tube') || (shapeRaw.includes('rect') && shapeRaw.includes('tube'))) ms = 'rectangular tube';
        else if (shapeRaw.includes('square bar') || (shapeRaw.includes('square') && shapeRaw.includes('bar'))) ms = 'square bar';
        else if (shapeRaw.includes('rectangular bar') || (shapeRaw.includes('rect') && shapeRaw.includes('bar'))) ms = 'rectangular bar';
        else if (shapeRaw.includes('hex')) ms = 'hexagonal bar';
        else if (shapeRaw.includes('unequal angle')) ms = 'unequal angle';
        else if (shapeRaw.includes('equal angle')) ms = 'equal angle';
        else if (shapeRaw.includes('angle')) ms = 'angle';
        else if (shapeRaw.includes('plate') || shapeRaw.includes('sheet')) ms = 'plate';
        else if (shapeRaw.includes('flat')) ms = 'flat bar';
        else if (shapeRaw.includes('pipe') || shapeRaw.includes('tube')) ms = 'pipe';
        else if (shapeRaw.includes('round') || shapeRaw.includes('rod') || shapeRaw.includes('bar')) {
          if (thk > 0) ms = 'threaded rod';
          else ms = 'round bar';
        }
        else if (dia > 0) {
          if (thk > 0) ms = 'threaded rod';
          else ms = 'round bar';
        }
        else if (od > 0 && thk > 0) ms = 'pipe';
        else if (wid > 0 && thk > 0 && len > 0) ms = 'plate';
        else ms = 'plate';

        let pfx = '', dp = [];
        if (ms === 'plate')              { pfx = 'PL';   dp = [nf(wid), nf(len), nf(thk)]; }
        else if (ms === 'flat bar')      { pfx = 'FL';   dp = [nf(wid), nf(thk), nf(len)]; }
        else if (ms === 'round bar')     { pfx = 'RB';   const dv = dia > 0 ? dia : (od > 0 ? od : wid); dp = [`Ø${nf(dv)}`, nf(len)]; }
        else if (ms === 'hexagonal bar') { pfx = 'HEX';  dp = [`AF${nf(wid)}`, nf(len)]; }
        else if (ms === 'square bar')    { pfx = 'SQ';   dp = [nf(wid), nf(len)]; }
        else if (ms === 'rectangular bar') { pfx = 'REC'; dp = [nf(wid), nf(od), nf(len)]; }
        else if (ms === 'pipe')          { pfx = 'PIPE'; const ov = od > 0 ? od : dia; dp = [`OD${nf(ov)}`, nf(thk), nf(len)]; }
        else if (ms === 'square tube')   { pfx = 'SQT';  dp = [nf(wid), nf(thk), nf(len)]; }
        else if (ms === 'rectangular tube') { pfx = 'RCT'; dp = [nf(wid), nf(od), nf(thk), nf(len)]; }
        else if (ms === 'threaded rod')  { pfx = 'TR';   const dv = dia > 0 ? dia : od; const pv = parseFloat(item.thread_pitch || item.threadPitch || thk || item.thickness || 0); dp = [`M${nf(dv)}`, pv > 0 ? nf(pv) : null, nf(len)]; }
        else if (ms === 'angle')         { pfx = 'L';    dp = [nf(wid), nf(od || thk), nf(thk), nf(len)]; }
        else if (ms === 'equal angle')   { pfx = 'EA';   dp = [nf(wid), nf(wid), nf(thk), nf(len)]; }
        else if (ms === 'unequal angle') { pfx = 'UA';   dp = [nf(wid), nf(od), nf(thk), nf(len)]; }
        else { dp = [nf(wid), nf(od), nf(thk), nf(dia), nf(len)]; }

        const clean = dp.filter(Boolean);
        if (clean.length > 0) dimsSpec = `${pfx} ${clean.join(' × ')} mm`.trim();
      }

      return {
        sr: idx + 1,
        itemCode: itemCode || '—',
        drawingNoOrCode: cleanDrawingNo || itemCode || '—',
        description: item.description || '—',
        materialName: item.material_name || item.materialName || '',
        drawingNo: cleanDrawingNo,
        qty: isReceiptOrGrn ? displayQty.toFixed(3) : `${displayQty.toFixed(3)} ${uom}`.trim(),
        unit: uom,
        rate: formatCurrency(rate),
        amount: formatCurrency(amountVal),
        dimsSpec
      };
    });

    const gstAmountVal = cgstAmountVal + sgstAmountVal;
    const grandTotalVal = subTotalVal + gstAmountVal;

    let renderData = {
      logoBase64,
      hostCompanyName,
      hostCompanyAddress,
      hostCompanyAddressLines,
      hostCompanyGST,
      isReceipt: type === 'receipt',
      isPO: type === 'po',
      isGRN: type === 'grn',
      items: mappedItems,
      subTotal: formatCurrency(subTotalVal),
      cgstPercent: cgstPercentVal,
      sgstPercent: sgstPercentVal,
      cgstAmount: formatCurrency(cgstAmountVal),
      sgstAmount: formatCurrency(sgstAmountVal),
      gstPercent: cgstPercentVal + sgstPercentVal,
      gstAmount: formatCurrency(gstAmountVal),
      grandTotal: formatCurrency(grandTotalVal)
    };

    if (isGRNOrReceipt) {
      let rawDate = Date.now();
      let rawId = 0;
      let notes = '';
      if (type === 'receipt' && receipt) {
        rawDate = receipt.receipt_date || receipt.created_at || Date.now();
        rawId = receipt.id;
        notes = receipt.notes || '';
      } else if (type === 'grn' && grn) {
        rawDate = grn.grn_date || grn.created_at || Date.now();
        rawId = grn.id;
        notes = grn.notes || '';
      }

      const year = new Date(rawDate).getFullYear();
      const receiptId = `GRN-${year}-${String(rawId).padStart(4, '0')}`;

      renderData = {
        ...renderData,
        poNumber: poDetail?.po_number || grn?.po_number || grn?.poNumber || receipt?.po_number || '—',
        poDate: poDetail?.created_at ? formatDate(poDetail.created_at) : '—',
        receiptId,
        receiptDate: formatDate(rawDate),
        refNo: poDetail?.po_number || grn?.po_number || grn?.poNumber || receipt?.po_number || '—',
        vendorName,
        vendorEmail,
        vendorPhone,
        vendorGST,
        deliveryDate: poDetail?.expected_delivery_date ? formatDate(poDetail.expected_delivery_date) : '—',
        paymentTerms: poDetail?.notes || '50% Advance Without taxes\n50% after delivery with taxes',
        transport: poDetail?.transport || 'inclusive',
        notes: notes
      };
    } else if (type === 'po' && po) {
      renderData = {
        ...renderData,
        poNumber: po.po_number || '—',
        poDate: formatDate(po.created_at),
        vendorName,
        vendorAddress: po.vendor_address || '',
        vendorGST,
        vendorPhone,
        vendorEmail,
        supplierCode: '',
        quotationRef: po.po_number || '—',
        paymentTerms: po.notes || '',
        deliveryDate: formatDate(po.expected_delivery_date),
        transport: 'inclusive',
        notes: po.notes || ''
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
