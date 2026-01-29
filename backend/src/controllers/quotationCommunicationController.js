const pool = require('../config/db');
const emailService = require('../utils/emailService');

const emailReceiver = require('../utils/realEmailReceiver');

const getCommunications = async (req, res, next) => {
  try {
    const { quotationId, type } = req.query;
    if (!quotationId || !type) {
      return res.status(400).json({ error: 'quotationId and type are required' });
    }

    const [rows] = await pool.query(
      `SELECT * FROM quotation_communications 
       WHERE quotation_id = ? AND quotation_type = ? 
       ORDER BY created_at ASC`,
      [quotationId, type]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
};

const sendCommunication = async (req, res, next) => {
  try {
    const { quotationId, quotationType, message, recipientEmail, quoteNumber } = req.body;
    
    if (!quotationId || !quotationType || !message || !recipientEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Save to database
    const [result] = await pool.execute(
      `INSERT INTO quotation_communications 
       (quotation_id, quotation_type, sender_type, message, created_at, is_read) 
       VALUES (?, ?, ?, ?, NOW(), 1)`,
      [quotationId, quotationType, 'SYSTEM', message]
    );

    // 2. Send email
    const subject = `Re: Quotation ${quoteNumber || 'QRT-' + String(quotationId).padStart(4, '0')}`;
    let emailSent = false;
    let emailMessageId = null;

    try {
      const emailResult = await emailService.sendReplyEmail(recipientEmail, subject, message);
      emailSent = true;
      emailMessageId = emailResult.messageId;

      // Update with email message ID
      await pool.execute(
        'UPDATE quotation_communications SET email_message_id = ? WHERE id = ?',
        [emailMessageId, result.insertId]
      );
    } catch (emailError) {
      console.error('[Communication Controller] Email sending failed:', emailError.message);
    }

    res.json({
      message: 'Communication sent successfully',
      id: result.insertId,
      emailSent
    });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const { quotationId, type } = req.body;
    await pool.execute(
      `UPDATE quotation_communications 
       SET is_read = 1 
       WHERE quotation_id = ? AND quotation_type = ? AND is_read = 0`,
      [quotationId, type]
    );
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    next(error);
  }
};

const getUnreadCounts = async (req, res, next) => {
  try {
    const { type } = req.query;
    const [rows] = await pool.query(
      `SELECT quotation_id, COUNT(*) as unread_count 
       FROM quotation_communications 
       WHERE quotation_type = ? AND is_read = 0 
       GROUP BY quotation_id`,
      [type || 'CLIENT']
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

const syncEmails = async (req, res, next) => {
  try {
    // This will trigger the processEmails function in the receiver
    // Since it's async and we don't want to wait for it to finish (might take long)
    // We just trigger it and return success
    emailReceiver.processEmails(); 
    res.json({ message: 'Email synchronization triggered' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCommunications,
  sendCommunication,
  markAsRead,
  getUnreadCounts,
  syncEmails
};