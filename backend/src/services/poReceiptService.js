const pool = require('../config/db');

const getPOReceipts = async (filters = {}) => {
  let query = `
    SELECT 
      pr.*,
      po.po_number,
      v.vendor_name,
      po.total_amount
    FROM po_receipts pr
    LEFT JOIN purchase_orders po ON po.id = pr.po_id
    LEFT JOIN vendors v ON v.id = po.vendor_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    query += ' AND pr.status = ?';
    params.push(filters.status);
  }

  if (filters.poId) {
    query += ' AND pr.po_id = ?';
    params.push(filters.poId);
  }

  query += ' ORDER BY pr.created_at DESC';

  const [receipts] = await pool.query(query, params);
  return receipts;
};

const getPOReceiptById = async (receiptId) => {
  const [rows] = await pool.query(
    `SELECT pr.*, po.po_number, v.vendor_name, po.total_amount
     FROM po_receipts pr
     LEFT JOIN purchase_orders po ON po.id = pr.po_id
     LEFT JOIN vendors v ON v.id = po.vendor_id
     WHERE pr.id = ?`,
    [receiptId]
  );

  if (!rows.length) {
    const error = new Error('PO Receipt not found');
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
};

const createPOReceipt = async (poId, receiptDate, receivedQuantity, notes) => {
  if (!poId) {
    const error = new Error('Purchase Order ID is required');
    error.statusCode = 400;
    throw error;
  }

  const [po] = await pool.query(
    'SELECT id FROM purchase_orders WHERE id = ?',
    [poId]
  );

  if (!po.length) {
    const error = new Error('Purchase Order not found');
    error.statusCode = 404;
    throw error;
  }

  const dateValue = receiptDate ? new Date(receiptDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  
  const [result] = await pool.execute(
    `INSERT INTO po_receipts (po_id, receipt_date, received_quantity, status, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [
      poId,
      dateValue,
      receivedQuantity || 0,
      'DRAFT',
      notes || null
    ]
  );

  return { id: result.insertId, po_id: poId };
};

const updatePOReceipt = async (receiptId, receiptDate, receivedQuantity, notes, status) => {
  await getPOReceiptById(receiptId);

  const updateFields = [];
  const updateValues = [];

  if (receiptDate !== undefined) {
    updateFields.push('receipt_date = ?');
    const dateOnly = new Date(receiptDate).toISOString().split('T')[0];
    updateValues.push(dateOnly);
  }

  if (receivedQuantity !== undefined) {
    updateFields.push('received_quantity = ?');
    updateValues.push(receivedQuantity);
  }

  if (notes !== undefined) {
    updateFields.push('notes = ?');
    updateValues.push(notes);
  }

  if (status !== undefined) {
    const validStatuses = ['DRAFT', 'SENT', 'RECEIVED', 'ACKNOWLEDGED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      const error = new Error('Invalid status');
      error.statusCode = 400;
      throw error;
    }
    updateFields.push('status = ?');
    updateValues.push(status);
  }

  if (updateFields.length === 0) {
    return { id: receiptId };
  }

  updateValues.push(receiptId);

  await pool.execute(
    `UPDATE po_receipts SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );

  return { id: receiptId };
};

const deletePOReceipt = async (receiptId) => {
  await getPOReceiptById(receiptId);
  await pool.execute('DELETE FROM po_receipts WHERE id = ?', [receiptId]);
};

const getPOReceiptStats = async () => {
  const [stats] = await pool.query(`
    SELECT 
      COUNT(*) as total_receipts,
      SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as draft_receipts,
      SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent_receipts,
      SUM(CASE WHEN status = 'RECEIVED' THEN 1 ELSE 0 END) as received_receipts,
      SUM(CASE WHEN status = 'ACKNOWLEDGED' THEN 1 ELSE 0 END) as acknowledged_receipts,
      SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed_receipts
    FROM po_receipts
  `);

  return stats[0] || {
    total_receipts: 0,
    draft_receipts: 0,
    sent_receipts: 0,
    received_receipts: 0,
    acknowledged_receipts: 0,
    closed_receipts: 0
  };
};

module.exports = {
  getPOReceipts,
  getPOReceiptById,
  createPOReceipt,
  updatePOReceipt,
  deletePOReceipt,
  getPOReceiptStats
};
