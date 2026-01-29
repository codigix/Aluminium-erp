const pool = require('../config/db');
const emailService = require('../utils/emailService');
const designOrderService = require('../services/designOrderService');

const getQuotationRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT qr.id as qr_id, qr.sales_order_id, qr.company_id, qr.status, qr.total_amount, qr.received_amount, qr.notes, qr.created_at, qr.rejection_reason,
             so.project_name, c.company_name, cp.po_number,
             COALESCE(soi.drawing_no, '—') as drawing_no,
             COALESCE(soi.description, so.project_name) as item_description,
             COALESCE(soi.quantity, 0) as item_qty,
             COALESCE(soi.unit, 'NOS') as item_unit,
             qr.id as id
      FROM quotation_requests qr
      JOIN sales_orders so ON so.id = qr.sales_order_id
      JOIN companies c ON c.id = qr.company_id
      LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
      LEFT JOIN sales_order_items soi ON soi.id = qr.sales_order_item_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      const statusArray = status.split(',');
      query += ` AND qr.status IN (${statusArray.map(() => '?').join(',')})`;
      params.push(...statusArray);
    }

    query += ' ORDER BY qr.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

const approveQuotationRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await pool.execute(
      'UPDATE quotation_requests SET status = ?, updated_at = NOW() WHERE id = ?',
      ['APPROVAL', id]
    );

    res.json({ message: 'Quotation request approved' });
  } catch (error) {
    next(error);
  }
};

const batchApproveQuotationRequests = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'IDs array is required' });
    }
    await connection.beginTransaction();
    for (const id of ids) {
      await connection.execute(
        'UPDATE quotation_requests SET status = ?, updated_at = NOW() WHERE id = ?',
        ['APPROVAL', id]
      );
    }
    await connection.commit();
    res.json({ message: 'Quotations moved to approval' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const batchSendToDesign = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { ids } = req.body; // Quotation Request IDs
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'IDs array is required' });
    }

    await connection.beginTransaction();

    // 1. Get unique Sales Order IDs from these quotation requests
    const [quotes] = await connection.query(
      `SELECT DISTINCT sales_order_id FROM quotation_requests WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );

    const salesOrderIds = quotes.map(q => q.sales_order_id);

    // 2. Update Quotation Requests status
    await connection.execute(
      `UPDATE quotation_requests SET status = ?, updated_at = NOW() WHERE id IN (${ids.map(() => '?').join(',')})`,
      ['COMPLETED', ...ids]
    );

    // 3. Update Sales Orders status and move to Design
    if (salesOrderIds.length > 0) {
      await connection.execute(
        `UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 1, updated_at = NOW() 
         WHERE id IN (${salesOrderIds.map(() => '?').join(',')})`,
        ['DESIGN_IN_REVIEW', 'DESIGN_ENG', ...salesOrderIds]
      );

      // 4. Create Design Orders
      for (const soId of salesOrderIds) {
        await designOrderService.createDesignOrder(soId, connection, 'IN_DESIGN');
      }
    }

    await connection.commit();
    res.json({ message: 'Quotations sent to Design Engineering' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const rejectQuotationRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    await pool.execute(
      'UPDATE quotation_requests SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
      ['REJECTED', reason || null, id]
    );

    res.json({ message: 'Quotation request rejected' });
  } catch (error) {
    next(error);
  }
};

const sendQuotationViaEmail = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { clientId, clientEmail, clientName, items, totalAmount, notes } = req.body;

    if (!clientEmail || !clientName || !items || items.length === 0) {
      return res.status(400).json({ 
        error: 'Missing required fields: clientEmail, clientName, items' 
      });
    }

    await connection.beginTransaction();

    const quotationPromises = items.map(item => {
      return new Promise(async (resolve, reject) => {
        try {
          const lineTotal = (item.quotedPrice || 0) * (item.quantity || 1);
          const lineTotalInclGst = lineTotal * 1.18;
          const [result] = await connection.execute(
            `INSERT INTO quotation_requests (sales_order_id, sales_order_item_id, company_id, status, total_amount, received_amount, rejection_reason, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [item.orderId, item.salesOrderItemId || null, clientId, item.status || 'PENDING', lineTotal, lineTotalInclGst, item.rejection_reason || null, notes || null]
          );
          resolve(result.insertId);
        } catch (error) {
          reject(error);
        }
      });
    });

    const quotationIds = await Promise.all(quotationPromises);

    const uniqueOrderIds = [...new Set(items.map(i => i.orderId))].filter(Boolean);

    if (uniqueOrderIds.length > 0) {
      await connection.execute(
        `UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 1, updated_at = NOW() 
         WHERE id IN (${uniqueOrderIds.map(() => '?').join(',')})`,
        ['QUOTATION_SENT', 'SALES', ...uniqueOrderIds]
      );
    }

    await connection.commit();

    let emailSent = false;
    let emailMessageId = null;
    const firstQuotationId = quotationIds[0];
    const quoteNumber = `QRT-${String(firstQuotationId).padStart(4, '0')}`;

    try {
      const emailResult = await emailService.sendQuotationEmail(
        clientEmail,
        clientName,
        items,
        totalAmount,
        notes,
        clientId,
        quoteNumber
      );
      emailSent = true;
      emailMessageId = emailResult.messageId;

      // Log to communications for ALL quotations in this batch
      const messageText = `Quotation ${quoteNumber} sent to client.\nTotal Amount: ₹${(totalAmount * 1.18).toLocaleString('en-IN')}\nItems: ${items.length}`;
      
      for (const qId of quotationIds) {
        await pool.execute(
          `INSERT INTO quotation_communications 
           (quotation_id, quotation_type, sender_type, message, email_message_id, created_at, is_read) 
           VALUES (?, ?, ?, ?, ?, NOW(), 1)`,
          [qId, 'CLIENT', 'SYSTEM', messageText, emailMessageId]
        );
      }

    } catch (emailError) {
      console.error('[Quotation Controller] Email sending failed:', emailError.message);
    }

    res.json({
      message: 'Quotation created successfully',
      quotationIds: quotationIds,
      emailSent: emailSent
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const deleteQuotationRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute(
      'DELETE FROM quotation_requests WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Quotation request not found' });
    }

    res.json({ message: 'Quotation request deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const updateQuotationRates = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { items } = req.body; // Array of { id, rate }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    await connection.beginTransaction();

    for (const item of items) {
      await connection.execute(
        'UPDATE quotation_requests SET total_amount = ?, received_amount = ?, updated_at = NOW() WHERE id = ?',
        [item.rate * item.qty, item.received_amount || 0, item.id]
      );
    }

    await connection.commit();
    res.json({ message: 'Quotation rates updated successfully' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

module.exports = {
  getQuotationRequests,
  approveQuotationRequest,
  batchApproveQuotationRequests,
  batchSendToDesign,
  rejectQuotationRequest,
  sendQuotationViaEmail,
  deleteQuotationRequest,
  updateQuotationRates
};
