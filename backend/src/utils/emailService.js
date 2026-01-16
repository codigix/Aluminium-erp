const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

const generateQuotationHTML = (clientName, items, totalAmount, notes) => {
  const itemsHTML = (items || [])
    .map((item, idx) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; text-align: left;">SO-${String(item.orderId).padStart(4, '0')}</td>
        <td style="padding: 12px; text-align: left;">Item ${idx + 1}</td>
        <td style="padding: 12px; text-align: center;">1</td>
        <td style="padding: 12px; text-align: right; font-weight: bold;">₹${(item.quotedPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quotation Request</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; }
        .header h1 { margin: 0 0 5px 0; font-size: 28px; }
        .header p { margin: 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 30px; }
        .client-info { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .client-info h3 { margin: 0 0 15px 0; color: #1f2937; font-size: 16px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { font-size: 14px; }
        .info-label { color: #6b7280; font-size: 12px; margin-bottom: 3px; }
        .info-value { color: #1f2937; font-weight: 500; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background-color: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #374151; font-size: 13px; }
        .totals { margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; }
        .total-row { display: flex; justify-content: flex-end; margin-bottom: 10px; font-size: 14px; }
        .total-label { margin-right: 40px; color: #6b7280; }
        .total-amount { font-weight: 600; color: #1f2937; min-width: 150px; text-align: right; }
        .grand-total { font-size: 18px; font-weight: bold; color: #10b981; }
        .notes-section { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .notes-section h3 { margin: 0 0 10px 0; color: #1f2937; font-size: 14px; }
        .notes-section p { margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5; }
        .footer { background-color: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
        .btn { display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Quotation Request</h1>
          <p>Professional quotation for your approved drawings</p>
        </div>
        
        <div class="content">
          <div class="client-info">
            <h3>Client Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">CLIENT NAME</div>
                <div class="info-value">${clientName}</div>
              </div>
              <div class="info-item">
                <div class="info-label">DATE</div>
                <div class="info-value">${new Date().toLocaleDateString('en-IN')}</div>
              </div>
            </div>
          </div>

          <h3 style="color: #1f2937; margin-bottom: 15px;">Quotation Items</h3>
          <table>
            <thead>
              <tr style="border-bottom: 2px solid #e5e7eb;">
                <th style="text-align: left;">Order ID</th>
                <th style="text-align: left;">Description</th>
                <th style="text-align: center;">Items</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span class="total-label">Total Quotation Value:</span>
              <span class="total-amount grand-total">₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          ${notes ? `
            <div class="notes-section">
              <h3>Additional Notes</h3>
              <p>${notes.replace(/\n/g, '<br>')}</p>
            </div>
          ` : ''}

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 13px; margin: 0 0 15px 0;">Please review this quotation and let us know if you have any questions or require modifications. Reply to this email or contact our sales team to discuss further.</p>
            <a href="mailto:sales@sptechpioneer.com" class="btn">Contact Sales</a>
          </div>
        </div>

        <div class="footer">
          <p style="margin: 0;">This is an automated quotation. Please do not reply to this email address.</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} SP Tech Pioneer. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
};

const sendQuotationEmail = async (clientEmail, clientName, items, totalAmount, notes) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@sptechpioneer.com',
      to: clientEmail,
      subject: `Quotation Request from SP Tech Pioneer - ${clientName}`,
      html: generateQuotationHTML(clientName, items, totalAmount, notes),
      replyTo: process.env.REPLY_TO_EMAIL || 'sales@sptechpioneer.com'
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Email Service] Quotation sent successfully:', info.messageId);
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
