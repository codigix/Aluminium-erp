const nodemailer = require('nodemailer');

let transporter;

const initializeMailer = () => {
  if (transporter) return transporter;

  const mailConfig = {
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT || '587'),
    secure: process.env.MAIL_ENCRYPTION === 'tls' ? false : true,
    auth: {
      user: process.env.MAIL_FROM_ADDRESS,
      pass: process.env.MAIL_PASSWORD
    }
  };

  transporter = nodemailer.createTransport(mailConfig);
  return transporter;
};

const sendEmail = async (to, subject, message, attachments = []) => {
  try {
    const mailer = initializeMailer();

    if (!process.env.MAIL_FROM_ADDRESS || !process.env.MAIL_PASSWORD) {
      console.warn('[emailService] Email not configured. Skipping actual send.');
      console.log(`[emailService] Would send to: ${to}`);
      console.log(`[emailService] Subject: ${subject}`);
      return {
        success: true,
        message: 'Email queued (mail service not configured)',
        to,
        subject
      };
    }

    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@example.com',
      to,
      subject,
      text: message,
      html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
      attachments
    };

    const info = await mailer.sendMail(mailOptions);
    console.log(`[emailService] Email sent to ${to}. Message ID: ${info.messageId}`);
    return {
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId,
      to,
      subject
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
  initializeMailer
};
