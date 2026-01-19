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

const generateQuotationHTML = (clientName, items, totalAmount, notes) => {
  const itemsHTML = (items || [])
    .map((item, idx) => `
      <tr>
        <td style="padding: 10px; border: 1px solid #000; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; border: 1px solid #000;">
          <div style="font-weight: bold;">${item.drawing_no || '—'}</div>
          ${item.description ? `<div style="font-size: 11px; color: #333; margin-top: 4px;">${item.description}</div>` : ''}
        </td>
        <td style="padding: 10px; border: 1px solid #000; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 10px; border: 1px solid #000; text-align: center;">${item.unit || 'Nos'}</td>
        <td style="padding: 10px; border: 1px solid #000; text-align: right;">₹${(item.quotedPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 10px; border: 1px solid #000; text-align: right; font-weight: bold;">₹${((item.quantity || 1) * (item.quotedPrice || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Quotation - SP TECHPIONEER</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #000; line-height: 1.4; padding: 20px; }
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
            Client ID: ${items[0]?.clientId || 'N/A'}
          </td>
          <td>
            <strong>Quotation Details:</strong><br>
            Date: ${new Date().toLocaleDateString('en-IN')}<br>
            Quote No: QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}
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

const sendQuotationEmail = async (clientEmail, clientName, items, totalAmount, notes) => {
  try {
    const transporter = createTransporter();
    const html = generateQuotationHTML(clientName, items, totalAmount, notes);
    
    // Generate PDF buffer
    let pdfBuffer;
    try {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();
    } catch (pdfError) {
      console.error('[Email Service] PDF generation failed:', pdfError.message);
      // Fallback to sending without PDF if generation fails
    }
    
    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.MAIL_FROM_ADDRESS || 'noreply@sptechpioneer.com',
      to: clientEmail,
      subject: `Quotation Request from SP TECHPIONEER - ${clientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
          <h2 style="color: #f26522;">Dear ${clientName},</h2>
          <p>Please find the attached quotation for your approved drawings from <strong>SP TECHPIONEER PVT. LTD.</strong></p>
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

module.exports = {
  sendQuotationEmail,
  generateQuotationHTML
};
