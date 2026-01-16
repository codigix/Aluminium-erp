const pool = require('../config/db');
const emailService = require('../utils/emailService');

const getQuotationRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT qr.*, so.id as sales_order_id, so.project_name, c.company_name, cp.po_number
      FROM quotation_requests qr
      JOIN sales_orders so ON so.id = qr.sales_order_id
      JOIN companies c ON c.id = qr.company_id
      LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND qr.status = ?';
      params.push(status);
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
      ['APPROVED', id]
    );

    res.json({ message: 'Quotation request approved' });
  } catch (error) {
    next(error);
  }
};

const rejectQuotationRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    await pool.execute(
      'UPDATE quotation_requests SET status = ?, updated_at = NOW() WHERE id = ?',
      ['REJECTED', id]
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
          const [result] = await connection.execute(
            `INSERT INTO quotation_requests (sales_order_id, company_id, status, total_amount, notes, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [item.orderId, clientId, 'PENDING', item.quotedPrice, notes || null]
          );
          resolve(result.insertId);
        } catch (error) {
          reject(error);
        }
      });
    });

    const quotationIds = await Promise.all(quotationPromises);

    await connection.execute(
      `UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 1, updated_at = NOW() 
       WHERE id IN (${items.map(() => '?').join(',')})`,
      ['DESIGN_APPROVED', 'SALES', ...items.map(i => i.orderId)]
    );

    await connection.commit();

    res.json({
      message: 'Quotation created successfully',
      quotationIds: quotationIds,
      emailSent: false
    });

    try {
      await emailService.sendQuotationEmail(
        clientEmail,
        clientName,
        items,
        totalAmount,
        notes
      );
    } catch (emailError) {
      console.error('[Quotation Controller] Email sending failed:', emailError.message);
    }
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

module.exports = {
  getQuotationRequests,
  approveQuotationRequest,
  rejectQuotationRequest,
  sendQuotationViaEmail,
  deleteQuotationRequest
};
