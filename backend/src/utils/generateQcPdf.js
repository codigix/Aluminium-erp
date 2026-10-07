const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const mustache = require('mustache');
const pool = require('../config/db');

const generateQcPdf = async (data) => {
  const { qc, items = [] } = data;

  try {
    const templatePath = path.join(__dirname, '../../templates/qc-report.html');
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
    let hostCompanyId = qc.host_company_id;

    if (!hostCompanyId && qc.grn_id) {
      try {
        const [rows] = await pool.query(
          `SELECT 
            COALESCE(
              (SELECT pr.host_company_id FROM po_receipts pr WHERE pr.id = g.po_receipt_id LIMIT 1),
              (SELECT q.host_company_id FROM purchase_orders po_inner JOIN quotations q ON po_inner.quotation_id = q.id WHERE po_inner.po_number = g.po_number LIMIT 1)
            ) as host_company_id
           FROM grns g
           WHERE g.id = ?`,
          [qc.grn_id]
        );
        if (rows.length > 0 && rows[0].host_company_id) {
          hostCompanyId = rows[0].host_company_id;
        }
      } catch (err) {
        console.error('[generateQcPdf] Error checking fallback hostCompanyId:', err.message);
      }
    }

    let activeCompany = null;
    if (hostCompanyId) {
      try {
        activeCompany = await adminCompanyMasterService.getCompanyById(hostCompanyId);
      } catch (err) {
        console.error(`[generateQcPdf] Error loading company profile:`, err.message);
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
    const hostCompanyAddress = activeCompany?.company_address || 'Plot No. 97, Sector 7, PCNTDA, Bhosari, Pune – 411026';

    const renderData = {
      logoBase64,
      hostCompanyName,
      hostCompanyAddress,
      reportNo: `QC-${new Date(qc.inspection_date || Date.now()).getFullYear()}-${String(qc.id).padStart(4, '0')}`,
      reportDate: formatDate(qc.inspection_date),
      grnNo: `GRN-${String(qc.grn_id).padStart(4, '0')}`,
      inspector: qc.inspector_name || 'QA Inspector',
      poNo: qc.po_number || '—',
      department: 'Quality Assurance',
      project: qc.project_name || 'Stock/Internal',
      status: qc.status,
      statusClass: qc.status === 'PASSED' || qc.status === 'ACCEPTED' ? 'status-passed' : 'status-failed',
      remarks: qc.remarks || 'Auto-created from Quality Inspection',
      totalItems: items.length,
      availableItems: items.filter(i => i.status === 'AVAILABLE' || i.accepted_qty > 0).length,
      items: items.map((item, idx) => {
        const recQty = parseFloat(item.received_qty || 0);
        const recWt = parseFloat(item.received_weight !== undefined && item.received_weight !== null ? item.received_weight : recQty);
        const inspQty = parseFloat(item.qc_inspection_qty !== undefined && item.qc_inspection_qty !== null ? item.qc_inspection_qty : recQty);
        const inspWt = parseFloat(item.qc_inspection_weight !== undefined && item.qc_inspection_weight !== null ? item.qc_inspection_weight : recWt);
        const accQty = parseFloat(item.accepted_qty !== undefined && item.accepted_qty !== null ? item.accepted_qty : inspQty);
        const rejQty = parseFloat(item.rejected_qty || 0);
        
        const accWt = parseFloat(item.accepted_weight !== undefined && item.accepted_weight !== null 
          ? item.accepted_weight 
          : (recQty > 0 ? (accQty / recQty) * recWt : inspWt));
        const rejWt = parseFloat(item.rejected_weight !== undefined && item.rejected_weight !== null 
          ? item.rejected_weight 
          : Math.max(0, recWt - accWt));

        let itemStatus = 'ACCEPTED';
        let statusColor = '#16a34a'; // Emerald

        if (rejQty > 0 || rejWt > 0.0005) {
          itemStatus = 'REJECTED';
          statusColor = '#dc2626'; // Red
        } else if (accQty < recQty) {
          itemStatus = 'SHORTAGE';
          statusColor = '#f59e0b'; // Amber
        }

        const getReason = () => {
          if (rejQty > 0 || rejWt > 0.0005) return 'Rejected';
          if (accQty >= recQty) return 'Accepted';
          return 'Accepted';
        };

        return {
          sr: idx + 1,
          poNo: item.po_number || qc.po_number || '—',
          partNo: item.item_code || '—',
          drawingNo: item.drawing_no || '—',
          description: item.material_name || item.description || '—',
          itemCode: item.item_code || '—',
          uom: item.uom || 'Nos',
          receivedQty: recQty.toFixed(0),
          inspectionQty: inspQty.toFixed(0),
          acceptedQty: accQty.toFixed(0),
          acceptedWeight: accWt.toFixed(3),
          rejectedQty: rejQty.toFixed(0),
          rejectedWeight: rejWt.toFixed(3),
          hasRejected: rejQty > 0 || rejWt > 0.0005,
          itemStatus: itemStatus,
          statusColor: statusColor,
          reason: getReason()
        };
      })
    };

    const html = mustache.render(template, renderData);

    const outputDir = path.join(__dirname, '../../pdf');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const pdfFileName = `QC_Report_${qc.id || Date.now()}.pdf`;
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
    console.error('QC PDF Generation Error:', error);
    throw error;
  }
};

module.exports = generateQcPdf;
