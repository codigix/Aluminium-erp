const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const mustache = require('mustache');

const generateJobCardQcPdf = async (data) => {
  const { log } = data;
  
  try {
    const templatePath = path.join(__dirname, '../../templates/job-card-qc-report.html');
    
    // Create template if not exists
    if (!fs.existsSync(templatePath)) {
        const defaultTemplate = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; background-color: #ffffff; }
        .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; position: relative; }
        .company-name { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.025em; text-transform: uppercase; }
        .report-title { font-size: 18px; font-weight: 600; color: #64748b; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 0.05em; }
        .logo-container { position: absolute; left: 0; top: 0; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; border: 1px solid #f1f5f9; border-radius: 12px; }
        .logo-container img { max-width: 60px; max-height: 60px; object-fit: contain; }
        
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
        .info-card { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 15px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; }
        .info-row:last-child { margin-bottom: 0; border-bottom: none; }
        .label { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .value { color: #0f172a; font-size: 13px; font-weight: 600; }

        .status-section { display: flex; align-items: center; justify-content: center; margin-bottom: 30px; gap: 40px; padding: 20px; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; }
        .status-badge { padding: 8px 24px; border-radius: 9999px; font-size: 14px; font-weight: 800; text-transform: uppercase; }
        .status-approved { background-color: #ecfdf5; color: #059669; border: 1px solid #10b981; }
        .status-pending { background-color: #fffbeb; color: #d97706; border: 1px solid #f59e0b; }
        
        table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
        th { background: #f8fafc; color: #475569; font-weight: 700; text-align: left; padding: 12px 15px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
        td { padding: 15px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        
        .qty-val { font-weight: 700; font-family: 'Courier New', monospace; }
        .accepted { color: #16a34a; background: #f0fdf4; padding: 4px 8px; border-radius: 6px; }
        .rejected { color: #dc2626; background: #fef2f2; padding: 4px 8px; border-radius: 6px; }

        .notes-area { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 40px; }
        .notes-title { font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 10px; text-transform: uppercase; }
        .notes-content { font-size: 13px; color: #334155; font-style: italic; }

        .seal-container { display: flex; justify-content: center; margin-top: 40px; }
        .quality-seal { border: 4px double #16a34a; border-radius: 50%; width: 120px; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #16a34a; transform: rotate(-15deg); opacity: 0.8; }
        .seal-text { font-size: 12px; font-weight: 900; text-transform: uppercase; text-align: center; line-height: 1.2; }
        .seal-icon { font-size: 32px; margin-bottom: 4px; }

        .footer { border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; color: #94a3b8; font-size: 10px; position: fixed; bottom: 20px; width: calc(100% - 40px); }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo-container">
            <img src="{{logoPath}}" alt="SP TECHPIONEER">
        </div>
        <h1 class="company-name">SP TECHPIONEER PVT. LTD.</h1>
        <p class="report-title">Quality Inspection Report (Production)</p>
    </div>

    <div class="info-grid">
        <div class="info-card">
            <div class="info-row">
                <span class="label">Report No</span>
                <span class="value">{{reportNo}}</span>
            </div>
            <div class="info-row">
                <span class="label">Inspection Date</span>
                <span class="value">{{check_date}}</span>
            </div>
            <div class="info-row">
                <span class="label">Shift</span>
                <span class="value">{{shift}}</span>
            </div>
        </div>
        <div class="info-card">
            <div class="info-row">
                <span class="label">Job Card No</span>
                <span class="value">{{job_card_no}}</span>
            </div>
            <div class="info-row">
                <span class="label">Work Order</span>
                <span class="value">{{wo_number}}</span>
            </div>
            <div class="info-row">
                <span class="label">Operation</span>
                <span class="value">{{operation_name}}</span>
            </div>
        </div>
    </div>

    <div class="info-card" style="margin-bottom: 30px;">
        <div class="info-row">
            <span class="label">Project / Customer</span>
            <span class="value">{{project_name}} / {{client_name}}</span>
        </div>
        <div class="info-row" style="margin-top: 8px; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
            <span class="label">Item Details</span>
            <span class="value">{{item_name}} ({{item_code}})</span>
        </div>
    </div>

    <div class="status-section">
        <div style="text-align: center;">
            <div class="label" style="margin-bottom: 8px;">Status</div>
            <div class="status-badge {{statusClass}}">{{status}}</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Parameters</th>
                <th style="text-align: center">Inspected Qty</th>
                <th style="text-align: center">Accepted Qty</th>
                <th style="text-align: center">Rejected Qty</th>
                <th style="text-align: center">Scrap Qty</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="font-weight: 600;">Production Quality Check</td>
                <td style="text-align: center" class="qty-val">{{inspected_qty}}</td>
                <td style="text-align: center" class="qty-val"><span class="accepted">{{accepted_qty}}</span></td>
                <td style="text-align: center" class="qty-val"><span class="rejected">{{rejected_qty}}</span></td>
                <td style="text-align: center" class="qty-val">{{scrap_qty}}</td>
            </tr>
        </tbody>
    </table>

    {{#rejection_reason}}
    <div class="notes-area" style="border-left: 4px solid #dc2626;">
        <div class="notes-title" style="color: #dc2626;">Rejection Reason</div>
        <div class="notes-content">{{rejection_reason}}</div>
    </div>
    {{/rejection_reason}}

    {{#notes}}
    <div class="notes-area">
        <div class="notes-title">Inspector Remarks</div>
        <div class="notes-content">{{notes}}</div>
    </div>
    {{/notes}}

    {{#isApproved}}
    <div class="seal-container">
        <div class="quality-seal">
            <div class="seal-icon">✓</div>
            <div class="seal-text">Quality<br>Assured</div>
        </div>
    </div>
    {{/isApproved}}

    <div class="footer">
        <p>This is a system-generated report and does not require physical signature.</p>
        <p>Plot No. 97, Sector 7, PCNTDA, Bhosari, Pune - 411 026</p>
    </div>
</body>
</html>
        `;
        const templateDir = path.dirname(templatePath);
        if (!fs.existsSync(templateDir)) fs.mkdirSync(templateDir, { recursive: true });
        fs.writeFileSync(templatePath, defaultTemplate);
    }

    const template = fs.readFileSync(templatePath, 'utf8');

    const formatDate = (date) => {
      if (!date) return '—';
      try {
        return new Date(date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      } catch {
        return date;
      }
    };

    const renderData = {
      logoPath: 'file://' + path.join(__dirname, '../../../frontend/src/assets/sptechpioneer logo.png'),
      reportNo: `QC-${new Date(log.check_date || Date.now()).getFullYear()}-${String(log.id).padStart(4, '0')}`,
      reportDate: formatDate(log.check_date),
      jobCardNo: log.job_card_no,
      inspector: 'QA Inspector',
      woNo: log.wo_number,
      department: 'Quality Assurance',
      project: `${log.project_name || 'Stock'} - Drawing ${log.drawing_no || '—'} for ${log.client_name || 'Internal'}`,
      status: log.status === 'APPROVED' ? 'PASSED' : log.status,
      statusClass: log.status === 'APPROVED' ? 'status-passed' : 'status-failed',
      itemName: log.item_name,
      itemCode: log.item_code,
      operationName: log.operation_name,
      designQty: `${parseFloat(log.planned_qty || 0).toFixed(3)} Nos`,
      requiredQty: `${parseFloat(log.inspected_qty || 0).toFixed(3)} Nos`,
      receivedQty: `${parseFloat(log.accepted_qty || 0).toFixed(3)} Nos`,
      itemStatus: log.status === 'APPROVED' ? 'AVAILABLE' : 'PENDING',
      statusColor: log.status === 'APPROVED' ? '#16a34a' : '#dc2626',
      remarks: log.notes || 'Auto-created from Quality Inspection',
      availableCount: log.status === 'APPROVED' ? 1 : 0,
      isApproved: log.status === 'APPROVED'
    };

    const html = mustache.render(template, renderData);

    const outputDir = path.join(__dirname, '../../pdf');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const pdfFileName = `JC_QC_Report_${log.id}.pdf`;
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
    console.error('Job Card QC PDF Generation Error:', error);
    throw error;
  }
};

module.exports = generateJobCardQcPdf;
