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
        const defaultTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Quality Control Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Helvetica', 'Arial', sans-serif;
      font-size: 10px;
      color: #333;
      line-height: 1.4;
      background: white;
      padding: 20px;
    }

    .report-container {
      width: 100%;
      border: 1px solid #000;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      border: 1px solid #000;
      padding: 5px;
      vertical-align: middle;
    }

    .header-section {
      border-bottom: 2px solid #000;
    }

    .logo-container {
      width: 120px;
      text-align: center;
      padding: 5px;
    }

    .logo-img {
      max-width: 110px;
      max-height: 60px;
      object-fit: contain;
    }

    .company-header {
      text-align: center;
      padding: 10px;
    }

    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: #f26522;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .report-title {
      font-size: 16px;
      font-weight: bold;
      margin-top: 5px;
      text-transform: uppercase;
    }

    .company-address {
      font-size: 10px;
      margin-top: 2px;
    }

    .info-table td {
      width: 25%;
      border: 1px solid #ccc;
    }

    .label {
      font-weight: bold;
      background-color: #f9f9f9;
    }

    .status-passed {
      color: #16a34a;
      font-weight: bold;
    }

    .status-passed-rejection {
      color: #d97706;
      font-weight: bold;
    }

    .status-failed {
      color: #dc2626;
      font-weight: bold;
    }

    .item-table {
      margin-top: 10px;
    }

    .item-table th {
      background-color: #f0f0f0;
      font-weight: bold;
      text-align: center;
    }

    .center {
      text-align: center;
    }

    .right {
      text-align: right;
    }

    .item-code {
      font-size: 8px;
      color: #666;
      display: block;
      margin-top: 2px;
    }

    .remarks-section {
      margin-top: 10px;
      padding: 8px;
      border: 1px solid #000;
    }

    .summary-section {
      margin-top: 10px;
      border: 1px solid #000;
    }

    .summary-section table td {
      border: none;
      padding: 3px 8px;
    }

    .footer-signatures {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0 20px;
    }

    .signature-box {
      text-align: center;
      width: 200px;
    }

    .signature-line {
      border-top: 1px solid #000;
      margin-bottom: 5px;
    }

    .seal-container {
      text-align: center;
    }

    .seal-circle {
      border: 3px solid #16a34a; 
      color: #16a34a; 
      border-radius: 50%; 
      width: 55px; 
      height: 55px; 
      margin: 0 auto; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      position: relative;
    }

    .seal-text {
      font-size: 8px; 
      font-weight: bold; 
      margin-bottom: 5px; 
      text-transform: uppercase;
      color: #16a34a;
    }

    .system-generated {
      text-align: center;
      font-size: 8px;
      color: #666;
      margin-top: 20px;
      font-style: italic;
    }

    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Header -->
    <table>
      <tr>
        <td class="company-header" style="width: 100%;">
          <div class="company-name">SP TECHPIONEER PVT. LTD.</div>
          <div class="report-title">QUALITY CONTROL REPORT</div>
          <div class="company-address">Plot No. 97, Sector 7, PCNTDA, Bhosari, Pune – 411026</div>
        </td>
      </tr>
    </table>

    <!-- Info Section -->
    <table class="info-table">
      <tr>
        <td class="label">Report No.</td>
        <td>: {{reportNo}}</td>
        <td class="label">Report Date</td>
        <td>: {{reportDate}}</td>
      </tr>
      <tr>
        <td class="label">Job Card No.</td>
        <td>: {{jobCardNo}}</td>
        <td class="label">Inspector</td>
        <td>: {{inspector}}</td>
      </tr>
      <tr>
        <td class="label">Work Order No.</td>
        <td>: {{woNo}}</td>
        <td class="label">Department</td>
        <td>: {{department}}</td>
      </tr>
      <tr>
        <td class="label">Project</td>
        <td>: {{project}}</td>
        <td class="label">Report Status</td>
        <td class="{{statusClass}}">: {{status}}</td>
      </tr>
    </table>

    <!-- Item Table -->
    <table class="item-table">
      <thead>
        <tr>
          <th style="width: 40px;">Sr. No.</th>
          <th>Item Description</th>
          <th style="width: 100px;">Required Qty</th>
          <th style="width: 100px;">Accepted Qty</th>
          <th style="width: 100px;">Rejected Qty</th>
          <th style="width: 120px;">Rejection Reason</th>
          <th style="width: 100px;">QC Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="center">1</td>
          <td>
            <strong>{{itemName}}</strong>
            <span class="item-code">{{itemCode}}</span>
            <span class="item-code">{{operationName}}</span>
          </td>
          <td class="center">{{requiredQty}}</td>
          <td class="center">{{acceptedQty}}</td>
          <td class="center">{{rejectedQty}}</td>
          <td class="center">{{rejectionReason}}</td>
          <td class="center">
            <span class="status-passed">{{inspectionStatus}}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Remarks -->
    <div class="remarks-section">
      <strong>Remarks : </strong> {{remarks}}
    </div>

    <!-- Summary -->
    <div class="summary-section">
      <div style="padding: 5px; border-bottom: 1px solid #000; font-weight: bold; background: #f0f0f0;">SUMMARY</div>
      <table>
        <tr>
          <td style="width: 180px; font-weight: bold;">Total Produced Qty</td>
          <td style="font-weight: bold;">: {{requiredQty}}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Accepted Qty</td>
          <td style="font-weight: bold;">: {{acceptedQty}}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #dc2626;">Rejected Qty</td>
          <td style="font-weight: bold; color: #dc2626;">: {{rejectedQty}}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #d97706;">Rework Qty</td>
          <td style="font-weight: bold; color: #d97706;">: {{reworkQty}}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Inspection Status</td>
          <td style="font-weight: bold;">: {{inspectionStatus}}</td>
        </tr>
      </table>
    </div>

    <!-- Footer Signatures -->
    <div class="footer-signatures">
      <div class="signature-box">
        <div class="signature-line"></div>
        <strong>Inspector Signature</strong><br/>
        {{inspector}}<br/>
        {{reportDate}}
      </div>
      
      {{#isApproved}}
      <div class="seal-container">
        <div class="seal-text">Quality Assured</div>
        <div class="seal-circle">
          <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      </div>
      {{/isApproved}}

      <div class="signature-box">
        <div class="signature-line"></div>
        <strong>Approved By</strong><br/>
        (Name)<br/>
        (Designation)
      </div>
    </div>
  </div>

  <div class="system-generated">
    This is a system generated report and does not require physical signature.
  </div>
</body>
</html>`;
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

    const accepted = parseFloat(log.accepted_qty || 0);
    const rejected = parseFloat(log.rejected_qty || 0);
    const produced = parseFloat(log.inspected_qty || 0);

    let statusText = 'PENDING';
    let statusClass = 'status-failed';
    let statusColor = '#dc2626';

    if (accepted === produced && rejected === 0) {
      statusText = 'PASSED';
      statusClass = 'status-passed';
      statusColor = '#16a34a';
    } else if (accepted > 0 && rejected > 0) {
      statusText = 'QC CHECKED';
      statusClass = 'status-passed-rejection';
      statusColor = '#d97706';
    } else if (accepted === 0 && rejected > 0) {
      statusText = 'REJECTED';
      statusClass = 'status-failed';
      statusColor = '#dc2626';
    } else {
      statusText = log.status === 'APPROVED' ? 'PASSED' : log.status;
      statusClass = log.status === 'APPROVED' ? 'status-passed' : 'status-failed';
      statusColor = log.status === 'APPROVED' ? '#16a34a' : '#dc2626';
    }

    const renderData = {
      logoPath: 'file://' + path.join(__dirname, '../../../frontend/src/assets/sptechpioneer logo.png'),
      reportNo: `QC-${new Date(log.check_date || Date.now()).getFullYear()}-${String(log.id).padStart(4, '0')}`,
      reportDate: formatDate(log.check_date),
      jobCardNo: log.job_card_no,
      inspector: 'QA Inspector',
      woNo: log.wo_number,
      department: 'Quality Assurance',
      project: `${log.project_name || 'Stock'} - Drawing ${log.drawing_no || '—'} for ${log.client_name || 'Internal'}`,
      status: statusText,
      statusClass: statusClass,
      itemName: log.item_name,
      itemCode: log.item_code,
      operationName: log.operation_name,
      designQty: `${parseFloat(log.planned_qty || 0).toFixed(3)} Nos`,
      requiredQty: `${parseFloat(log.inspected_qty || 0).toFixed(3)} Nos`,
      receivedQty: `${parseFloat(log.accepted_qty || 0).toFixed(3)} Nos`,
      acceptedQty: `${parseFloat(log.accepted_qty || 0).toFixed(3)} Nos`,
      rejectedQty: `${parseFloat(log.rejected_qty || 0).toFixed(3)} Nos`,
      rejectionReason: log.rejection_reason || '—',
      reworkQty: `${parseFloat(log.rejected_qty || 0).toFixed(3)} Nos`,
      inspectionStatus: 'QC Checked',
      itemStatus: log.status === 'APPROVED' ? 'AVAILABLE' : 'PENDING',
      statusColor: statusColor,
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
