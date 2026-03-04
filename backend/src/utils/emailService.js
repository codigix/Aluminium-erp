const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');

const createTransporter = () => {
  const config = {
    service: process.env.EMAIL_SERVICE,
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || process.env.MAIL_FROM_ADDRESS,
      pass: process.env.EMAIL_PASSWORD || process.env.MAIL_PASSWORD
    }
  };

  // If service is provided (e.g. 'gmail'), nodemailer handles host/port
  if (config.service) {
    delete config.host;
    delete config.port;
  }

  return nodemailer.createTransport(config);
};

const generateQuotationHTML = (clientName, items, totalAmount, notes, clientId, quoteNumber) => {
  const itemsHTML = (items || [])
    .map((item, idx) => {
      const isRejected = item.status === 'REJECTED';
      const unitPrice = isRejected ? '<span style="color: #dc2626; font-weight: bold;">REJECTED</span>' : `₹${(item.quotedPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      const totalLine = isRejected ? '<span style="color: #dc2626; font-weight: bold;">REJECTED</span>' : `₹${((item.quantity || 1) * (item.quotedPrice || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      
      return `
      <tr>
        <td style="padding: 10px; border: 1px solid #000; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; border: 1px solid #000;">
          <div style="font-weight: bold;">${item.drawing_no || '—'}</div>
          ${item.description ? `<div style="font-size: 11px; color: #333; margin-top: 4px;">${item.description}</div>` : ''}
          ${isRejected ? `<div style="font-size: 10px; color: #dc2626; margin-top: 4px; font-weight: bold;">Reason: ${item.rejection_reason || 'Not specified'}</div>` : ''}
        </td>
        <td style="padding: 10px; border: 1px solid #000; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 10px; border: 1px solid #000; text-align: center;">${item.unit || 'Nos'}</td>
        <td style="padding: 10px; border: 1px solid #000; text-align: right;">${unitPrice}</td>
        <td style="padding: 10px; border: 1px solid #000; text-align: right; font-weight: bold;">${totalLine}</td>
      </tr>
    `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Quotation - SP TECHPIONEER</title>
      <style>
        body { font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif; font-size: 12px; color: #000; line-height: 1.4; padding: 20px; }
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .header-table td { padding: 10px; border: 1px solid #000; }
        .title { font-size: 24px; font-weight: bold; color: #f26522; text-align: center; }
        .company-name { font-size: 18px; font-weight: bold; text-align: center; margin-top: 5px; }
        .company-info { font-size: 11px; text-align: center; margin-top: 5px; }
        .quote-info { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .quote-info td { padding: 8px; border: 1px solid #000; width: 50%; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th { background-color: #f2f2f2; padding: 10px; border: 1px solid #000; text-align: center; font-weight: bold; }
        .totals-table { width: 40%; margin-left: auto; border-collapse: collapse; }
        .totals-table td { padding: 10px; border: 1px solid #000; }
        .footer { margin-top: 40px; font-size: 11px; }
        .signature-table { width: 100%; margin-top: 60px; border-collapse: collapse; }
        .signature-table td { text-align: center; border: none; font-weight: bold; }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td style="text-align: center; width: 100%;">
            <div class="title">QUOTATION</div>
            <div class="company-name">SP TECHPIONEER PVT. LTD.</div>
            <div class="company-info">
              Plot No. 97, Sector 7, PCNTDA, Bhosari, Pune – 411026<br>
              Email: sales@sptechpioneer.com | Mobile: +91 9876543210
            </div>
          </td>
        </tr>
      </table>

      <table class="quote-info">
        <tr>
          <td>
            <strong>Quotation For:</strong><br>
            <span style="font-size: 14px; font-weight: bold;">${clientName}</span><br>
            Client ID: ${clientId || 'N/A'}
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
            <th style="width: 45%;">Description / Drawing No</th>
            <th style="width: 10%;">Qty</th>
            <th style="width: 10%;">Unit</th>
            <th style="width: 15%;">Unit Price</th>
            <th style="width: 15%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <table class="totals-table">
        <tr>
          <td style="font-weight: bold;">Sub Total</td>
          <td style="text-align: right; font-weight: bold;">₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td>Tax (GST 18%)</td>
          <td style="text-align: right;">₹${(totalAmount * 0.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr style="background-color: #f2f2f2;">
          <td style="font-weight: bold; font-size: 14px;">Grand Total</td>
          <td style="text-align: right; font-weight: bold; font-size: 14px; color: #10b981;">₹${(totalAmount * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      </table>

      ${notes ? `
        <div style="margin-top: 20px; border: 1px solid #000; padding: 10px;">
          <strong>Terms & Conditions:</strong><br>
          <p style="white-space: pre-wrap; margin: 5px 0 0 0;">${notes}</p>
        </div>
      ` : `
        <div style="margin-top: 20px; border: 1px solid #000; padding: 10px;">
          <strong>Terms & Conditions:</strong><br>
          <ul style="margin: 5px 0 0 0; padding-left: 20px;">
            <li>Validity: 30 Days</li>
            <li>Payment: 50% Advance, 50% Against Delivery</li>
            <li>Delivery: Within 2-3 weeks from the date of PO</li>
          </ul>
        </div>
      `}

      <table class="signature-table">
        <tr>
          <td>
            <div style="border-top: 1px solid #000; width: 150px; margin: 0 auto; margin-bottom: 5px;"></div>
            Prepared By
          </td>
          <td>
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
        .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
        .header p { margin: 5px 0 0; font-size: 12px; opacity: 0.9; }
        .title-section { padding: 20px 40px; display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; }
        .title-section h2 { margin: 0; font-size: 28px; color: #1e3a8a; }
        .info-grid { padding: 30px 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .card { border: 1px solid #f1f5f9; border-radius: 12px; background: #f8fafc; overflow: hidden; }
        .card-header { background: #f1f5f9; padding: 8px 15px; font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; }
        .card-body { padding: 15px; font-size: 12px; }
        .table-container { padding: 0 40px; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; border: 2px solid #f1f5f9; border-radius: 15px; overflow: hidden; }
        th { background: #e0e7ff; color: #1e3a8a; font-size: 10px; text-transform: uppercase; padding: 12px; text-align: left; }
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
                  <div style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">Billing Address:</div>
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
                  <span style="color: #94a3b8; font-size: 10px; text-transform: uppercase;">Transporter:</span>
                  <span style="font-weight: bold;">${challan.transporter || '—'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #94a3b8; font-size: 10px; text-transform: uppercase;">Vehicle No:</span>
                  <span style="background: #eef2ff; color: #4338ca; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${challan.vehicle_number || '—'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #94a3b8; font-size: 10px; text-transform: uppercase;">Driver:</span>
                  <span style="font-weight: bold;">${challan.driver_name || '—'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #94a3b8; font-size: 10px; text-transform: uppercase;">Dispatch Time:</span>
                  <span style="font-weight: bold;">${dispatchTime}</span>
                </div>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #e2e8f0; overflow: hidden;">
                  <div style="float: left; width: 45%; background: #f1f5f9; padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">Total Qty</div>
                    <div style="font-size: 16px; font-weight: bold; color: #1e3a8a;">${totalQty} <span style="font-size: 9px;">PCS</span></div>
                  </div>
                  <div style="float: right; width: 45%; background: #f1f5f9; padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">Total Weight</div>
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
          <div style="font-size: 10px; font-weight: bold; color: #92400e; text-transform: uppercase; margin-bottom: 5px;">Remarks:</div>
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

    // If DISPATCHED, also CC the driver if they have an email (logic could be added to fetch driver email)
    // For now, if driver_contact looks like an email, we could try, but usually it's a phone.

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] Shipment ${status} email sent to ${email}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email Service] Failed to send shipment ${status} email:`, error.message);
    // Don't throw, just log to prevent breaking the main flow
  }
};

const sendQuotationEmail = async (clientEmail, clientName, items, totalAmount, notes, clientId, quoteNumber) => {
  try {
    const transporter = createTransporter();
    const html = generateQuotationHTML(clientName, items, totalAmount, notes, clientId, quoteNumber);
    
    // Generate PDF buffer
    let pdfBuffer;
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
      // We will proceed to send email without attachment if PDF fails
      // Alternatively, we could throw error if PDF is mandatory
    }
    
    const formattedQuoteNumber = quoteNumber ? `[${quoteNumber}]` : '';
    
    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.MAIL_FROM_ADDRESS || 'noreply@sptechpioneer.com',
      to: clientEmail,
      subject: `Quotation Request ${formattedQuoteNumber} from SP TECHPIONEER - ${clientName}`,
      html: `
        <div style="font-family: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6;">
          <h2 style="color: #f26522;">Dear ${clientName},</h2>
          <p>Please find the attached quotation ${formattedQuoteNumber} for your approved drawings from <strong>SP TECHPIONEER PVT. LTD.</strong></p>
          <p><strong>Total Quotation Value (Incl. GST):</strong> ₹${(totalAmount * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p>The detailed breakdown of items, quantities, and pricing is provided in the attached PDF.</p>
          <p>We look forward to your feedback and approval.</p>
          <br/>
          <p>Best regards,</p>
          <p><strong>Sales Team</strong><br/>SP TECHPIONEER PVT. LTD.</p>
          <p style="font-size: 11px; color: #666; margin-top: 20px;">Plot No. 97, Sector 7, PCNTDA, Bhosari, Pune – 411026</p>
        </div>
      `,
      replyTo: process.env.REPLY_TO_EMAIL || 'sales@sptechpioneer.com',
      attachments: pdfBuffer ? [
        {
          filename: `Quotation_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer
        }
      ] : []
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
      replyTo: process.env.REPLY_TO_EMAIL || 'sales@sptechpioneer.com'
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

module.exports = {
  sendQuotationEmail,
  generateQuotationHTML,
  sendReplyEmail,
  sendShipmentStatusEmail,
  generateChallanHTML
};
