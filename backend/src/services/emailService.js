const nodemailer = require('nodemailer');

let transporter;

const createTransporter = () => {
  const config = {
    service: process.env.EMAIL_SERVICE,
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_SECURE === 'true' || process.env.MAIL_PORT == 465,
    auth: {
      user: process.env.EMAIL_USER || process.env.MAIL_FROM_ADDRESS,
      pass: process.env.EMAIL_PASSWORD || process.env.MAIL_PASSWORD
    }
  };

  if (config.service) {
    delete config.host;
    delete config.port;
  }

  return nodemailer.createTransport(config);
};

const sendEmail = async (to, subject, message, attachments = []) => {
  try {
    const transporter = createTransporter();

    if (!process.env.MAIL_PASSWORD && !process.env.EMAIL_PASSWORD) {
      console.warn('[emailService] Email credentials missing. Skipping send.');
      return { success: false, message: 'Email credentials not configured' };
    }

    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.MAIL_FROM_ADDRESS || 'noreply@sptechpioneer.com',
      to,
      subject,
      text: message,
      html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId
    };
  } catch (error) {
    console.error('[emailService] Error sending email:', error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

const sendQuotationEmail = async (to, quotationNumber, message) => {
  const subject = `Quotation Request - ${quotationNumber}`;
  return sendEmail(to, subject, message);
};

module.exports = {
  sendEmail,
  sendQuotationEmail,
  createTransporter
};
