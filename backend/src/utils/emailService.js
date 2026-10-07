const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const pool = require('../config/db');

const createTransporter = () => {
  const isGmail = process.env.MAIL_HOST === 'smtp.gmail.com';

  const config = {
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || process.env.MAIL_FROM_ADDRESS,
      pass: process.env.EMAIL_PASSWORD || process.env.MAIL_PASSWORD
    }
  };

  // Gmail specific configuration for better reliability
  if (isGmail) {
    config.service = 'gmail';
    // If using service: 'gmail', nodemailer handles host/port/secure
    delete config.host;
    delete config.port;
    if (process.env.MAIL_SECURE !== 'true') {
      delete config.secure;
    }
  }

  return nodemailer.createTransport(config);
};

const generateQuotationHTML = async (clientName, items, totalAmount, notes, clientId, quoteNumber, hostCompany = null, clientDetails = null) => {
  for (let item of items) {
    if (!item.hsn_code) {
      let hsn = '—';
      if (item.drawing_no) {
        const [dRows] = await pool.query('SELECT hsn_code FROM customer_drawings WHERE drawing_no = ?', [item.drawing_no]);
        if (dRows.length > 0 && dRows[0].hsn_code) hsn = dRows[0].hsn_code;
      }
      if (hsn === '—' && item.item_code) {
        const [iRows] = await pool.query('SELECT hsn_code FROM items WHERE item_code = ?', [item.item_code]);
        if (iRows.length > 0 && iRows[0].hsn_code) hsn = iRows[0].hsn_code;
      }
      item.hsn_code = hsn;
    }
  }
  let subTotal = 0;
  let totalTax = 0;
  let totalProfit = 0;
  let totalOverride = 0;

  const itemsHTML = (items || [])
    .map((item, idx) => {
      const isRejected = item.status === 'REJECTED';
      const quantity = item.quantity || 1;
      const profitP = parseFloat(item.profit_percentage) || 0;
      const overrideP = parseFloat(item.override_percentage) || 0;
      const gstRate = item.gst_percentage !== undefined && item.gst_percentage !== null && item.gst_percentage !== '' ? parseFloat(item.gst_percentage) : 18;

      // Calculate rates
      // item.quotedPrice already includes profit (it's the Unit Rate from UI)
      const unitRate = parseFloat(item.quotedPrice) || 0;
      const lineTotalBase = unitRate * quantity;
      const lineTax = lineTotalBase * (gstRate / 100);
      const lineTotalWithTax = lineTotalBase + lineTax;

      if (!isRejected) {
        subTotal += lineTotalBase;
        totalTax += lineTax;

        // Calculate profit & override amounts for this line
        const bomCost = parseFloat(item.bom_cost) || 0;
        const itemBomCost = bomCost || (unitRate / (1 + profitP / 100) / (1 + overrideP / 100)) || 0;
        const profitAmount = itemBomCost * (profitP / 100) * quantity;
        const overrideAmount = (itemBomCost * (1 + profitP / 100)) * (overrideP / 100) * quantity;

        totalProfit += profitAmount;
        totalOverride += overrideAmount;
      }

      const unitPriceStr = isRejected ?
        '<span style="color: #dc2626; font-weight: bold;">REJECTED</span>' :
        `₹${unitRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      const totalLineStr = isRejected ?
        '<span style="color: #dc2626; font-weight: bold;">REJECTED</span>' :
        `₹${lineTotalBase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      // PDF: Always use solid border for main rows (child parts are hidden)
      const mainItemRow = `
      <tr>
        <td style="padding: 10px; border: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
          <div style="font-weight: bold; color: #000;">${item.drawing_no || '—'}</div>
          ${item.description ? `<div style="font-weight: bold; color: #000; font-size: 12px; text-transform: uppercase; margin-top: 4px;">${item.description}</div>` : ''}
          ${isRejected ? `<div style="font-size: 10px; color: #dc2626; margin-top: 4px; font-weight: bold;">Reason: ${item.rejection_reason || 'Not specified'}</div>` : ''}
        </td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; text-align: center;">${item.hsn_code || '—'}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; text-align: center;">${quantity}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; text-align: right;">${unitPriceStr}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${totalLineStr}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; text-align: left;">${item.item_notes || '—'}</td>
      </tr>
    `;

      // Child part rows are hidden in the PDF (internal use only)
      return mainItemRow;
    })
    .join('');

  const fs = require('fs');
  const path = require('path');
  let logoBase64 = null;
  let signatureBase64 = null;

  if (hostCompany && hostCompany.company_logo) {
    const logoPath = path.join(__dirname, '../../', hostCompany.company_logo);
    if (fs.existsSync(logoPath)) {
      logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    }
  }

  if (hostCompany && hostCompany.authorized_signature) {
    const signaturePath = path.join(__dirname, '../../', hostCompany.authorized_signature);
    if (fs.existsSync(signaturePath)) {
      signatureBase64 = `data:image/png;base64,${fs.readFileSync(signaturePath).toString('base64')}`;
    }
  }

  const hostCompanyName = hostCompany?.company_name || 'SP TECHPIONEER PVT. LTD.';
  const hostCompanyAddress = hostCompany?.company_address || 'Plot No. 97, Sector 7, PCNTDA, Bhosari, Pune – 411026';

  let hostCompanyAddressHtml = '';
  if (hostCompanyAddress) {
    const parts = hostCompanyAddress.split(/[\r\n,]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      const mid = Math.ceil(parts.length / 2);
      const line1 = parts.slice(0, mid).join(', ');
      const line2 = parts.slice(mid).join(', ');
      hostCompanyAddressHtml = `${line1}<br/>${line2}`;
    } else {
      hostCompanyAddressHtml = 'Sector No 7, Plot No 97, PCNTDA<br/>Bhosari, Pune - 411026, Maharashtra';
    }
  } else {
    hostCompanyAddressHtml = 'Sector No 7, Plot No 97, PCNTDA<br/>Bhosari, Pune - 411026, Maharashtra';
  }

  const hostEmail = hostCompany?.email || hostCompany?.company_email || 'reactjscodigix@gmail.com';
  const hostPhone = hostCompany?.phone || hostCompany?.company_phone || hostCompany?.contact_mobile || '+91 9876543210';

  const discountType = (items && items[0]) ? items[0].discount_type || 'percentage' : 'percentage';
  const discountValue = (items && items[0]) ? parseFloat(items[0].discount_value) || 0 : 0;

  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = subTotal * (discountValue / 100);
  } else {
    discountAmount = discountValue;
  }
  if (discountAmount > subTotal) discountAmount = subTotal;

  const discountRatio = subTotal > 0 ? (subTotal - discountAmount) / subTotal : 1;
  const finalTax = totalTax * discountRatio;
  const grandTotal = subTotal - discountAmount;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Quotation - ${hostCompanyName}</title>
      <style>
        body { font-family: 'roboto', sans-serif; font-size: 12px; color: #000; line-height: 1.4; padding: 20px; }
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .header-table td { padding: 10px; border: 1px solid #cbd5e1; }
        .title { font-size: 24px; font-weight: bold; color: #f26522; text-align: center; }
        .company-name { font-size: 18px; font-weight: bold; text-align: center; margin-top: 5px; }
        .company-info { font-size: 11px; text-align: center; margin-top: 5px; }
        .quote-info { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .quote-info td { padding: 8px; border: 1px solid #cbd5e1; width: 50%; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th { background-color: #f8fafc; padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; }
        .totals-table { width: 40%; margin-left: auto; border-collapse: collapse; }
        .totals-table td { padding: 10px; border: 1px solid #cbd5e1; }
        .footer { margin-top: 40px; font-size: 11px; }
        .signature-table { width: 100%; margin-top: 60px; border-collapse: collapse; }
        .signature-table td { text-align: center; border: none; font-weight: bold; }
      </style>
    </head>
    <body>
      <div style="position: relative; border: 1px solid #cbd5e1; padding: 10px; margin-bottom: 20px;">
        ${logoBase64 ? `
        <div style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; justify-content: center;">
          <img src="${logoBase64}" style="max-height: 70px; max-width: 140px; object-fit: contain;" />
        </div>
        ` : ''}
        <div style="width: 100%; text-align: center;">
          <div class="title">QUOTATION</div>
          <div class="company-name">${hostCompanyName}</div>
          <div class="company-info">
            ${hostCompanyAddressHtml}<br>
            Email: ${hostEmail} | Mobile: ${hostPhone}
          </div>
        </div>
      </div>

      <table class="quote-info">
        <tr>
          <td>
            <strong>Quotation For:</strong><br>
            <span style="font-size: 14px; font-weight: bold;">${clientName}</span><br>
            Client ID: ${clientId || 'N/A'}<br>
            ${clientDetails?.contact_person ? `Contact Person: ${clientDetails.contact_person}<br>` : ''}
            ${clientDetails?.email ? `Email: ${clientDetails.email}<br>` : ''}
            ${clientDetails?.phone ? `Phone: ${clientDetails.phone}<br>` : ''}
            ${clientDetails?.gstin ? `GST No: ${clientDetails.gstin}<br>` : ''}
          </td>
          <td>
            <strong>Quotation Details:</strong><br>
            Date: ${new Date().toLocaleDateString('en-IN')}<br>
            Quote No: ${quoteNumber || `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`}
          </td>
        </tr>
      </table>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 5%;">Sr. No</th>
            <th style="width: 32%;">Description / Drawing No</th>
            <th style="width: 10%;">HSN Code</th>
            <th style="width: 8%;">Qty</th>
            <th style="width: 15%;">Unit Rate (₹)</th>
            <th style="width: 15%;">Total (₹)</th>
            <th style="width: 15%;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <table class="totals-table">
        <tr style="background-color: #f8fafc; border-top: 2px solid #e2e8f0;">
          <td style="font-weight: bold; font-size: 14px; color: #1e3a8a;">Grand Total</td>
          <td style="text-align: right; font-weight: bold; font-size: 14px; color: #059669;">₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      </table>

      ${((notes && !notes.trim().startsWith('Drawing Numbers:')) || hostCompany?.invoice_footer_notes) ? `
        <div style="margin-top: 20px; border: 1px solid #cbd5e1; padding: 10px;">
          <strong>Terms & Conditions:</strong><br>
          <p style="white-space: pre-wrap; margin: 5px 0 0 0;">${(notes && !notes.trim().startsWith('Drawing Numbers:')) ? notes : hostCompany.invoice_footer_notes}</p>
        </div>
      ` : `
        <div style="margin-top: 20px; border: 1px solid #cbd5e1; padding: 10px;">
          <strong>Terms & Conditions:</strong><br>
          <ol style="margin: 5px 0 0 0; padding-left: 20px; line-height: 1.6;">
            <li>Prices mentioned are inclusive/exclusive of GST as applicable.</li>
            <li>Delivery schedule will be as per mutually agreed timeline.</li>
            <li>Payment terms: As per agreed quotation terms.</li>
            <li>Any change in drawing/specification may affect cost and delivery.</li>
            <li>Quotation validity: 15 Days from quotation date.</li>
            <li>This is a computer-generated quotation and does not require physical signature.</li>
          </ol>
        </div>
      `}

      <table class="signature-table">
        <tr>
          <td>
            <div style="height: 50px;"></div>
            <div style="border-top: 1px solid #000; width: 150px; margin: 0 auto; margin-bottom: 5px;"></div>
            Prepared By
          </td>
          <td>
            <div style="height: 50px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
              ${signatureBase64 ? `<img src="${signatureBase64}" style="max-height: 50px; max-width: 150px; object-fit: contain;" />` : ''}
            </div>
            <div style="border-top: 1px solid #000; width: 150px; margin: 0 auto; margin-bottom: 5px;"></div>
            Authorized Signatory
          </td>
        </tr>
      </table>

      <div class="footer" style="text-align: center; margin-top: 50px; color: #666; border-top: 1px solid #eee; padding-top: 10px;">
        This is a computer generated quotation and does not require a physical signature.
      </div>
    </body>
    </html>
  `;

  return html;
};

const generateChallanHTML = (challan) => {
  const dispatchDate = challan.dispatch_time ? new Date(challan.dispatch_time).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
  const dispatchTime = challan.dispatch_time ? new Date(challan.dispatch_time).toLocaleTimeString('en-IN') : new Date().toLocaleTimeString('en-IN');
  const totalQty = (challan.items || []).reduce((sum, item) => sum + Number(item.quantity), 0).toFixed(0);

  const itemsHTML = (challan.items || [])
    .map((item, idx) => `
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #1e3a8a;">${item.item_code}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${item.description || ''}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">732690</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${Number(item.quantity).toFixed(0)}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${item.unit || 'PCS'}</td>
      </tr>
    `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: sans-serif; color: #334155; margin: 0; padding: 0; line-height: 1.5; }
        .container { width: 210mm; margin: 0 auto; background: white; border: 1px solid #e2e8f0; }
        .header { background-color: #4f6ebc; color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; text-transform: ; letter-spacing: 2px; }
        .header p { margin: 5px 0 0; font-size: 12px; opacity: 0.9; }
        .title-section { padding: 20px 40px; display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; }
        .title-section h2 { margin: 0; font-size: 28px; color: #1e3a8a; }
        .info-grid { padding: 30px 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .card { border: 1px solid #f1f5f9; border-radius: 12px; background: #f8fafc; overflow: hidden; }
        .card-header { background: #f1f5f9; padding: 8px 15px; font-size: 10px; font-weight: bold; color: #64748b; text-transform: ; }
        .card-body { padding: 15px; font-size: 12px; }
        .table-container { padding: 0 40px; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; border: 2px solid #f1f5f9; border-radius: 15px; overflow: hidden; }
        th { background: #e0e7ff; color: #1e3a8a; font-size: 10px; text-transform: ; padding: 12px; text-align: left; }
        .totals { background: #fffbeb; border: 2px solid #fde68a; padding: 20px; border-radius: 20px; margin: 20px 40px; }
        .footer { background: #f1f5f9; padding: 15px; text-align: center; font-size: 9px; color: #64748b; margin-top: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SPTECHPIONEER PRIVATE LIMITED</h1>
          <p>MIDC Bhosari, Pune – 411026, Maharashtra</p>
          <p>GSTIN: 27ABCDE1234F1Z5 | Phone: +91-9876543210</p>
        </div>
        <div style="padding: 20px 40px; border-bottom: 2px solid #f1f5f9; overflow: hidden;">
          <div style="float: left;"><h2 style="margin:0; color:#1e3a8a;">DELIVERY CHALLAN</h2></div>
          <div style="float: right; text-align: right; font-size: 11px; color: #64748b; font-weight: bold;">
            <div>CHALLAN NO: <span style="color:#0f172a;">${challan.challan_number}</span></div>
            <div>DATE: <span style="color:#0f172a;">${dispatchDate}</span></div>
            <div>SHIPMENT: <span style="color:#0f172a;">${challan.shipment_code}</span></div>
          </div>
        </div>
        <div style="padding: 20px 40px; overflow: hidden;">
          <div style="float: left; width: 48%;">
            <div class="card">
              <div class="card-header">Bill To:</div>
              <div class="card-body">
                <div style="font-size: 16px; font-weight: bold; color: #1e3a8a;">${challan.snapshot_customer_name || challan.customer_name}</div>
                <div style="margin-top: 5px; color: #475569;">
                  GSTIN: ${challan.snapshot_customer_gst || '27XXXXX1234Z1A1'}<br>
                  Contact: ${challan.snapshot_customer_phone || 'N/A'}<br>
                  Email: ${challan.snapshot_customer_email || 'N/A'}
                </div>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                  <div style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: ;">Billing Address:</div>
                  <div style="margin-top: 3px;">${challan.snapshot_billing_address || 'N/A'}</div>
                </div>
              </div>
            </div>
            <div class="card" style="margin-top: 15px;">
              <div class="card-header">Ship To:</div>
              <div class="card-body">${challan.snapshot_shipping_address || 'Address not set'}</div>
            </div>
          </div>
          <div style="float: right; width: 48%;">
            <div class="card">
              <div class="card-header">Transport Details:</div>
              <div class="card-body">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #94a3b8; font-size: 10px; text-transform: ;">Transporter:</span>
                  <span style="font-weight: bold;">${challan.transporter || '—'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #94a3b8; font-size: 10px; text-transform: ;">Vehicle No:</span>
                  <span style="background: #eef2ff; color: #4338ca; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${challan.vehicle_number || '—'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #94a3b8; font-size: 10px; text-transform: ;">Driver:</span>
                  <span style="font-weight: bold;">${challan.driver_name || '—'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #94a3b8; font-size: 10px; text-transform: ;">Dispatch Time:</span>
                  <span style="font-weight: bold;">${dispatchTime}</span>
                </div>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #e2e8f0; overflow: hidden;">
                  <div style="float: left; width: 45%; background: #f1f5f9; padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: ;">Total Qty</div>
                    <div style="font-size: 16px; font-weight: bold; color: #1e3a8a;">${totalQty} <span style="font-size: 9px;">PCS</span></div>
                  </div>
                  <div style="float: right; width: 45%; background: #f1f5f9; padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: ;">Total Weight</div>
                    <div style="font-size: 16px; font-weight: bold; color: #1e3a8a;">200 <span style="font-size: 9px;">KG</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">Sr</th>
                <th>Item Code</th>
                <th>Description</th>
                <th style="width: 60px; text-align: center;">HSN</th>
                <th style="width: 60px; text-align: right;">Qty</th>
                <th style="width: 60px; text-align: center;">Unit</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
        </div>
        <div class="totals">
          <div style="font-size: 10px; font-weight: bold; color: #92400e; text-transform: ; margin-bottom: 5px;">Remarks:</div>
          <div style="font-size: 12px; color: #b45309; font-style: italic;">"${challan.remarks || 'Material sent for delivery. Please check items and quantities before receiving.'}"</div>
        </div>
        <div class="footer">
          THIS IS A COMPUTER GENERATED DELIVERY CHALLAN. SUBJECT TO PUNE JURISDICTION.
        </div>
      </div>
    </body>
    </html>
  `;
};

const sendShipmentStatusEmail = async (shipmentData, status, attachments = []) => {
  try {
    const transporter = createTransporter();
    const {
      snapshot_customer_name,
      customer_name,
      snapshot_customer_email,
      customer_email,
      shipment_code,
      driver_name,
      driver_contact,
      driver_email,
      vehicle_number,
      transporter: transporterName
    } = shipmentData;

    const name = snapshot_customer_name || customer_name;
    const email = snapshot_customer_email || customer_email;

    // Determine recipients
    let recipients = [];
    if (email) recipients.push(email);

    // For DISPATCHED, add driver email to recipients if available
    if (status === 'DISPATCHED' && driver_email) {
      recipients.push(driver_email);
    }

    if (recipients.length === 0) {
      console.warn(`[Email Service] No recipients found for shipment ${shipment_code}, skipping notification.`);
      return;
    }

    let subject = '';
    let body = '';

    switch (status) {
      case 'DISPATCHED':
        subject = `Shipment Dispatched: ${shipment_code} - SPTECHPIONEER`;
        body = `
          <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
            <h2 style="color: #4f6ebc;">Shipment Dispatched</h2>
            <p>Dear ${name},</p>
            <p>We are pleased to inform you that your shipment <strong>${shipment_code}</strong> has been dispatched from our warehouse.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px; color: #1e3a8a;">Delivery Details:</h4>
              <p style="margin: 5px 0;"><strong>Transporter:</strong> ${transporterName || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Vehicle No:</strong> ${vehicle_number || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Driver:</strong> ${driver_name || 'N/A'} (${driver_contact || 'N/A'})</p>
            </div>
            <p>Please find the attached Delivery Challan for your reference.</p>
            <p>Best regards,<br/><strong>Logistics Team</strong><br/>SPTECHPIONEER PVT. LTD.</p>
          </div>
        `;
        break;
      case 'OUT_FOR_DELIVERY':
        subject = `Out for Delivery: ${shipment_code} - SPTECHPIONEER`;
        body = `
          <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
            <h2 style="color: #f59e0b;">Out for Delivery</h2>
            <p>Dear ${name},</p>
            <p>Great news! Your shipment <strong>${shipment_code}</strong> is out for delivery and should reach you today.</p>
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px; color: #92400e;">Delivery Contact:</h4>
              <p style="margin: 5px 0;"><strong>Driver:</strong> ${driver_name || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Contact No:</strong> ${driver_contact || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Vehicle No:</strong> ${vehicle_number || 'N/A'}</p>
            </div>
            <p>Please ensure someone is available to receive the material.</p>
            <p>Best regards,<br/><strong>Logistics Team</strong><br/>SPTECHPIONEER PVT. LTD.</p>
          </div>
        `;
        break;
      case 'DELIVERED':
        subject = `Shipment Delivered: ${shipment_code} - SPTECHPIONEER`;
        body = `
          <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
            <h2 style="color: #10b981;">Successfully Delivered</h2>
            <p>Dear ${name},</p>
            <p>Your shipment <strong>${shipment_code}</strong> has been successfully delivered.</p>
            <p>Thank you for choosing SPTECHPIONEER PVT. LTD. We hope to serve you again soon!</p>
            <p>Best regards,<br/><strong>Customer Success Team</strong><br/>SPTECHPIONEER PVT. LTD.</p>
          </div>
        `;
        break;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.MAIL_FROM_ADDRESS || 'noreply@sptechpioneer.com',
      to: recipients.join(','),
      subject: subject,
      html: body,
      attachments: attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] Shipment ${status} email sent to ${email}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email Service] Failed to send shipment ${status} email:`, error.message);
  }
};

const sendQuotationEmail = async (clientEmail, clientName, items, totalAmount, notes, clientId, quoteNumber, hostCompanyId = null, passedClientDetails = null, customSubject = null, customMessage = null, attachPDF = true, customAttachments = [], cc = null, bcc = null) => {
  try {
    const transporter = createTransporter();
    const adminCompanyMasterService = require('../services/adminCompanyMasterService');
    let hostCompany = null;
    if (hostCompanyId) {
      try {
        hostCompany = await adminCompanyMasterService.getCompanyById(hostCompanyId);
      } catch (err) {
        console.error('Error fetching host company in email service:', err);
      }
    }
    if (!hostCompany) {
      try {
        hostCompany = await adminCompanyMasterService.getActiveCompany();
      } catch (err) {
        console.error('Error fetching active company in email service:', err);
      }
    }

    let clientDetails = { email: '', phone: '', gstin: '' };
    if (clientId) {
      try {
        const [clientRows] = await pool.query(
          `SELECT c.gstin,
                  (SELECT email FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1) as email,
                  (SELECT phone FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1) as phone
           FROM companies c WHERE c.id = ?`,
          [clientId]
        );
        if (clientRows.length > 0) {
          clientDetails = {
            email: clientRows[0].email || '',
            phone: clientRows[0].phone || '',
            gstin: clientRows[0].gstin || ''
          };
        }
      } catch (err) {
        console.error('Error fetching client details in email service:', err);
      }
    }

    if (passedClientDetails) {
      clientDetails = {
        ...clientDetails,
        ...passedClientDetails
      };
    }

    // Generate PDF buffer only if attachPDF is true
    let pdfBuffer;
    if (attachPDF) {
      const html = await generateQuotationHTML(clientName, items, totalAmount, notes, clientId, quoteNumber, hostCompany, clientDetails);
      try {
        const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
        });
        await browser.close();
      } catch (pdfError) {
        console.error('[Email Service] PDF generation failed:', pdfError.message);
      }
    }

    const formattedQuoteNumber = quoteNumber ? `[${quoteNumber}]` : '';

    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.MAIL_FROM_ADDRESS || 'noreply@sptechpioneer.com',
      to: clientEmail,
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
      subject: customSubject || `Quotation Request ${formattedQuoteNumber} from SP TECHPIONEER - ${clientName}`,
      html: customMessage ? `
        <div style="font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6;">
          <p>${customMessage.replace(/\n/g, '<br>')}</p>
        </div>
      ` : `
        <div style="font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6;">
          <h2 style="color: #f26522;">Dear ${clientName},</h2>
          <p>Please find the attached quotation ${formattedQuoteNumber} for your approved drawings from <strong>SP TECHPIONEER PVT. LTD.</strong></p>
          <p><strong>Total Quotation Value (Incl. GST):</strong> ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p>The detailed breakdown of items, quantities, and pricing is provided in the attached PDF.</p>
          <p>We look forward to your feedback and approval.</p>
          <br/>
          <p>Best regards,</p>
          <p><strong>Sales Team</strong><br/>SP TECHPIONEER PVT. LTD.</p>
          <p style="font-size: 11px; color: #666; margin-top: 20px;">Plot No. 97, Sector 7, PCNTDA, Bhosari, Pune – 411026</p>
        </div>
      `,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.MAIL_FROM_ADDRESS || 'reactjscodigix@gmail.com',
      attachments: [
        ...((attachPDF && pdfBuffer) ? [{
          filename: `Quotation_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer
        }] : []),
        ...(customAttachments || []).map(att => ({
          filename: att.filename,
          content: att.content,
          encoding: 'base64'
        }))
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Email Service] Quotation sent successfully with PDF:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send quotation email:', error.message);
    throw new Error(`Failed to send quotation email: ${error.message}`);
  }
};

const sendReplyEmail = async (to, subject, message, replyToId) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.MAIL_FROM_ADDRESS || 'noreply@sptechpioneer.com',
      to: to,
      subject: subject,
      html: `
        <div style="font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6;">
          <div style="white-space: pre-wrap;">${message}</div>
          <br/>
          <p>Best regards,</p>
          <p><strong>Sales Team</strong><br/>SP TECHPIONEER PVT. LTD.</p>
        </div>
      `,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.MAIL_FROM_ADDRESS || 'reactjscodigix@gmail.com'
    };

    if (replyToId) {
      mailOptions.inReplyTo = replyToId;
      mailOptions.references = [replyToId];
    }

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send reply email:', error.message);
    throw new Error(`Failed to send reply email: ${error.message}`);
  }
};

const generateQuotationPDF = async (clientName, items, totalAmount, notes, clientId, quoteNumber, hostCompanyId = null, passedClientDetails = null) => {
  const adminCompanyMasterService = require('../services/adminCompanyMasterService');
  let hostCompany = null;
  if (hostCompanyId) {
    try {
      hostCompany = await adminCompanyMasterService.getCompanyById(hostCompanyId);
    } catch (err) {
      console.error('Error fetching host company in PDF service:', err);
    }
  }
  if (!hostCompany) {
    try {
      hostCompany = await adminCompanyMasterService.getActiveCompany();
    } catch (err) {
      console.error('Error fetching active company in PDF service:', err);
    }
  }

  let clientDetails = { email: '', phone: '', gstin: '' };
  if (clientId) {
    try {
      const [clientRows] = await pool.query(
        `SELECT c.gstin,
                (SELECT email FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1) as email,
                (SELECT phone FROM contacts WHERE company_id = c.id AND (contact_type = 'PRIMARY' OR contact_type = 'PURCHASE') LIMIT 1) as phone
         FROM companies c WHERE c.id = ?`,
        [clientId]
      );
      if (clientRows.length > 0) {
        clientDetails = {
          email: clientRows[0].email || '',
          phone: clientRows[0].phone || '',
          gstin: clientRows[0].gstin || ''
        };
      }
    } catch (err) {
      console.error('Error fetching client details in PDF service:', err);
    }
  }

  if (passedClientDetails) {
    clientDetails = {
      ...clientDetails,
      ...passedClientDetails
    };
  }

  const html = await generateQuotationHTML(clientName, items, totalAmount, notes, clientId, quoteNumber, hostCompany, clientDetails);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
    printBackground: true
  });
  await browser.close();
  return pdf;
};

const generateCostBreakdownPDF = async (clientName, quoteNumber, projectName, dataRows) => {
  // Get body rows (exclude the last placeholder row, which is the Grand Total row sent from controller)
  const bodyRows = dataRows.slice(1, -1);
  const grandTotalEntry = dataRows[dataRows.length - 1];

  // Compute column sums from parent (non-child) rows
  const NUM_COLS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19];
  const colTotals = {};
  NUM_COLS.forEach(c => { colTotals[c] = 0; });
  let totalQty = 0;

  bodyRows.forEach(r => {
    const isChild = typeof r[0] === 'string' && r[0].startsWith('↳');
    if (!isChild) {
      NUM_COLS.forEach(c => { colTotals[c] += (parseFloat(r[c]) || 0); });
      totalQty += (parseFloat(r[17]) || 0);
    }
  });

  const fmt = (val) =>
    (val !== undefined && val !== null && val !== '')
      ? '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '₹0.00';

  const fmtOrBlank = (val) =>
    (val !== undefined && val !== null && val !== '' && !isNaN(Number(val)) && Number(val) !== 0)
      ? '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';

  const formattedRowsHtml = bodyRows.map(r => {
    const isChild    = typeof r[0] === 'string' && r[0].startsWith('↳');
    const isAssembly = r[3] === 'ASM';

    let rowClass = '';
    if (isChild)    rowClass = 'child-row bg-slate-50';
    else if (isAssembly) rowClass = 'font-bold bg-slate-50';

    return `
      <tr class="${rowClass}">
        <td class="text-center" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${r[0] || ''}</td>
        <td class="${isChild ? 'pl-4' : 'font-bold'}" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${r[1] || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4px 3px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r[2] || ''}</td>
        <td class="text-center font-bold" style="border: 1px solid #cbd5e1; padding: 4px 3px; color: ${isAssembly ? '#2563eb' : '#475569'};">${r[3] || ''}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[4])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[5])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[6])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[7])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[8])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[9])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[10])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[11])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[12])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[13])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[14])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[15])}</td>
        <td class="text-right" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmt(r[16])}</td>
        <td class="text-center font-bold" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${r[17] !== undefined ? r[17] : ''}</td>
        <td class="text-right font-semibold" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmtOrBlank(r[18])}</td>
        <td class="text-right font-bold text-indigo-750" style="border: 1px solid #cbd5e1; padding: 4px 3px;">${fmtOrBlank(r[19])}</td>
      </tr>
    `;
  }).join('');

  // ── Grand Total row HTML ──
  const grandTotalHtml = `
    <tr class="bg-slate-100 font-bold">
      <td colspan="4" class="text-left font-bold" style="border: 1px solid #94a3b8; padding: 5px 4px;">Grand Total</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[4])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[5])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[6])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[7])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[8])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[9])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[10])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[11])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[12])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[13])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[14])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[15])}</td>
      <td class="text-right" style="border: 1px solid #94a3b8; padding: 5px 3px;">${fmt(colTotals[16])}</td>
      <td class="text-center" style="border: 1px solid #94a3b8; padding: 5px 3px;">${totalQty}</td>
      <td style="border: 1px solid #94a3b8; padding: 5px 3px;"></td>
      <td class="text-right font-bold" style="border: 1px solid #94a3b8; padding: 5px 3px; color: #1e40af;">
        ${fmt(parseFloat(grandTotalEntry[19]) || colTotals[19])}
      </td>
    </tr>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Cost Breakdown - ${quoteNumber}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        @page {
          size: A3 landscape;
          margin: 10mm;
        }

        body {
          font-family: 'Inter', sans-serif;
          margin: 0;
          padding: 0;
          color: #1e293b;
          font-size: 9.5px;
          background-color: #ffffff;
          -webkit-print-color-adjust: exact;
        }
        .container {
          width: 100%;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .company-title {
          font-size: 18px;
          font-weight: 700;
          color: #1e3a8a;
          margin: 0;
        }
        .doc-title {
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          margin: 3px 0 0 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .metadata-box {
          text-align: right;
          font-size: 10px;
          color: #475569;
          line-height: 1.4;
        }
        .metadata-row {
          margin-bottom: 2px;
        }
        .metadata-label {
          font-weight: 600;
          color: #1e293b;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 5px;
        }
        th {
          background-color: #f1f5f9;
          color: #1e293b;
          font-weight: 700;
          text-align: center;
          border: 1px solid #94a3b8;
          padding: 5px 3px;
          font-size: 9px;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .font-bold {
          font-weight: 700;
        }
        .pl-4 {
          padding-left: 12px !important;
        }
        .bg-slate-50 {
          background-color: #f8fafc;
        }
        .bg-slate-100 {
          background-color: #e2e8f0;
        }
        .child-row {
          color: #475569;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div>
            <h1 class="company-title">${clientName}</h1>
            <h2 class="doc-title">Quotation Cost Breakdown Sheet</h2>
          </div>
          <div class="metadata-box">
            <div class="metadata-row"><span class="metadata-label">Quotation No:</span> ${quoteNumber}</div>
            <div class="metadata-row"><span class="metadata-label">Project:</span> ${projectName || '—'}</div>
            <div class="metadata-row"><span class="metadata-label">Date:</span> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 45px;">Sr No</th>
              <th style="text-align: left; width: 180px;">Component Number</th>
              <th style="text-align: left; width: 250px;">Description</th>
              <th style="width: 60px;">Type</th>
              <th class="text-right" style="width: 85px;">Material Cost</th>
              <th class="text-right" style="width: 85px;">CNC/Turning</th>
              <th class="text-right" style="width: 85px;">Milling/Cutting</th>
              <th class="text-right" style="width: 85px;">VMC</th>
              <th class="text-right" style="width: 85px;">Drilling</th>
              <th class="text-right" style="width: 85px;">Tapping</th>
              <th class="text-right" style="width: 85px;">Grinding</th>
              <th class="text-right" style="width: 100px;">Laser Cutting</th>
              <th class="text-right" style="width: 85px;">Sparking</th>
              <th class="text-right" style="width: 85px;">Finish</th>
              <th class="text-right" style="width: 85px;">QC</th>
              <th class="text-right" style="width: 85px;">Packing</th>
              <th class="text-right" style="width: 100px;">Profit & Overheads</th>
              <th style="width: 45px;">Qty</th>
              <th class="text-right" style="width: 85px;">Unit Price</th>
              <th class="text-right" style="width: 95px;">Total Price</th>
            </tr>
          </thead>
          <tbody>
            ${formattedRowsHtml}
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A3',
    landscape: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    printBackground: true
  });
  await browser.close();
  return pdf;
};

module.exports = {
  sendQuotationEmail,
  generateQuotationHTML,
  generateQuotationPDF,
  generateCostBreakdownPDF,
  sendReplyEmail,
  sendShipmentStatusEmail,
  generateChallanHTML
};
