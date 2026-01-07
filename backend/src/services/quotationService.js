const pool = require('../config/db');
const emailService = require('./emailService');

const generateQuoteNumber = async () => {
  const timestamp = Date.now();
  return `QT-${timestamp}`;
};

const createQuotation = async (payload) => {
  const {
    vendorId,
    salesOrderId,
    validUntil,
    notes,
    items = [],
    status = 'DRAFT'
  } = payload;

  if (!vendorId) {
    const error = new Error('Vendor is required');
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const quoteNumber = await generateQuoteNumber();

    const [result] = await connection.execute(
      `INSERT INTO quotations (quote_number, vendor_id, sales_order_id, status, valid_until, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
      ,
      [quoteNumber, vendorId, salesOrderId || null, status, validUntil || null, notes || null]
    );

    const quotationId = result.insertId;
    let totalAmount = 0;

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const amount = (item.quantity || 0) * (item.unit_rate || 0);
        totalAmount += amount;

        await connection.execute(
          `INSERT INTO quotation_items (quotation_id, item_code, description, quantity, unit, unit_rate, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
          ,
          [
            quotationId,
            item.item_code || null,
            item.description || null,
            item.quantity || 0,
            item.unit || 'NOS',
            item.unit_rate || 0,
            amount
          ]
        );
      }
    }

    await connection.execute(
      'UPDATE quotations SET total_amount = ? WHERE id = ?',
      [totalAmount, quotationId]
    );

    await connection.commit();
    return { id: quotationId, quote_number: quoteNumber };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getQuotations = async (filters = {}) => {
  let query = 'SELECT * FROM quotations WHERE 1=1';
  const params = [];

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.vendorId) {
    query += ' AND vendor_id = ?';
    params.push(filters.vendorId);
  }

  query += ' ORDER BY created_at DESC';

  const [quotations] = await pool.query(query, params);

  const [items] = await pool.query('SELECT * FROM quotation_items');

  return quotations.map(q => ({
    ...q,
    items: items.filter(i => i.quotation_id === q.id)
  }));
};

const getQuotationById = async (quotationId) => {
  const [rows] = await pool.query(
    'SELECT * FROM quotations WHERE id = ?',
    [quotationId]
  );

  if (!rows.length) {
    const error = new Error('Quotation not found');
    error.statusCode = 404;
    throw error;
  }

  const [items] = await pool.query(
    'SELECT * FROM quotation_items WHERE quotation_id = ?',
    [quotationId]
  );

  return { ...rows[0], items };
};

const updateQuotationStatus = async (quotationId, status) => {
  const validStatuses = ['DRAFT', 'SENT', 'RECEIVED', 'REVIEWED', 'CLOSED', 'PENDING'];
  if (!validStatuses.includes(status)) {
    const error = new Error('Invalid status');
    error.statusCode = 400;
    throw error;
  }

  await getQuotationById(quotationId);

  await pool.execute(
    'UPDATE quotations SET status = ? WHERE id = ?',
    [status, quotationId]
  );

  return status;
};

const updateQuotation = async (quotationId, payload) => {
  const { validUntil, notes, items } = payload;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const updateFields = [];
    const updateParams = [];

    if (validUntil !== undefined) {
      updateFields.push('valid_until = ?');
      updateParams.push(validUntil);
    }

    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateParams.push(notes);
    }

    if (updateFields.length > 0) {
      updateParams.push(quotationId);
      await connection.execute(
        `UPDATE quotations SET ${updateFields.join(', ')} WHERE id = ?`,
        updateParams
      );
    }

    if (Array.isArray(items) && items.length > 0) {
      await connection.execute('DELETE FROM quotation_items WHERE quotation_id = ?', [quotationId]);

      let totalAmount = 0;

      for (const item of items) {
        const amount = (item.quantity || 0) * (item.unit_rate || 0);
        totalAmount += amount;

        await connection.execute(
          `INSERT INTO quotation_items (quotation_id, item_code, description, quantity, unit, unit_rate, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
          ,
          [
            quotationId,
            item.item_code || null,
            item.description || null,
            item.quantity || 0,
            item.unit || 'NOS',
            item.unit_rate || 0,
            amount
          ]
        );
      }

      await connection.execute(
        'UPDATE quotations SET total_amount = ? WHERE id = ?',
        [totalAmount, quotationId]
      );
    }

    await connection.commit();
    return { id: quotationId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteQuotation = async (quotationId) => {
  await getQuotationById(quotationId);
  await pool.execute('DELETE FROM quotations WHERE id = ?', [quotationId]);
};

const getQuotationStats = async () => {
  const [stats] = await pool.query(`
    SELECT 
      COUNT(*) as total_quotations,
      SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent_quotations,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_quotations,
      SUM(CASE WHEN status = 'REVIEWED' THEN 1 ELSE 0 END) as approved_quotations,
      SUM(total_amount) as total_value
    FROM quotations
  `);

  return stats[0] || {
    total_quotations: 0,
    sent_quotations: 0,
    pending_quotations: 0,
    approved_quotations: 0,
    total_value: 0
  };
};

const sendQuotationEmail = async (quotationId, emailData) => {
  const { to, subject, message, attachPDF } = emailData;

  const quotation = await getQuotationById(quotationId);

  if (!to || !subject || !message) {
    const error = new Error('Email recipient, subject, and message are required');
    error.statusCode = 400;
    throw error;
  }

  if (!to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    const error = new Error('Invalid email address');
    error.statusCode = 400;
    throw error;
  }

  try {
    const emailResult = await emailService.sendEmail(to, subject, message);
    
    console.log(`[sendQuotationEmail] Email sent successfully to ${to}`);
    
    await pool.execute(
      'UPDATE quotations SET status = ? WHERE id = ?',
      ['SENT', quotationId]
    );

    return {
      id: quotationId,
      sent_to: to,
      sent_at: new Date(),
      message: emailResult.message,
      messageId: emailResult.messageId
    };
  } catch (error) {
    console.error(`[sendQuotationEmail] Error: ${error.message}`);
    throw error;
  }
};

module.exports = {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotationStatus,
  updateQuotation,
  deleteQuotation,
  getQuotationStats,
  sendQuotationEmail
};
