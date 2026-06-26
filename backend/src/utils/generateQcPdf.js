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
        const shortage = Math.max(0, parseFloat(item.ordered_qty || 0) - parseFloat(item.accepted_qty || 0));
        const overage = Math.max(0, parseFloat(item.accepted_qty || 0) - parseFloat(item.ordered_qty || 0));

        let itemStatus = 'AVAILABLE';
        let statusColor = '#16a34a'; // Emerald

        if (shortage > 0) {
          itemStatus = 'SHORTAGE';
          statusColor = '#dc2626'; // Red
        } else if (overage > 0) {
          itemStatus = 'OVERAGE';
          statusColor = '#2563eb'; // Blue
        }

        return {
          sr: idx + 1,
          description: item.material_name || item.description || '—',
          itemCode: item.item_code || '—',
          uom: item.uom || 'Nos',
          designQty: parseFloat(item.design_qty || 0).toFixed(3),
          requiredQty: parseFloat(item.ordered_qty || 0).toFixed(3),
          receivedQty: parseFloat(item.received_qty || 0).toFixed(3),
          shortage: shortage.toFixed(3),
          overage: overage.toFixed(3),
          itemStatus: itemStatus,
          statusColor: statusColor
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
