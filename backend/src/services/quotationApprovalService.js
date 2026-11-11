// RFQ Vendor Quotation → Admin Approval workflow.
//
//   RECEIVED / REJECTED --submitForApproval--> PENDING_APPROVAL
//   PENDING_APPROVAL --approve--> REVIEWED (shown as "Approved") + unique approval code (QA-YYYY-MM-####)
//   PENDING_APPROVAL --reject--> REJECTED (reason required)
//
// Approval NEVER creates a Purchase Order. PO creation stays a separate Procurement action
// (purchaseOrderService.createPurchaseOrder), which only accepts REVIEWED quotations.
const pool = require('../config/db');

const httpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  return error;
};

const SUBMITTABLE_STATUSES = ['RECEIVED', 'REJECTED'];

const lockQuotation = async (connection, quotationId) => {
  const [rows] = await connection.query('SELECT * FROM quotations WHERE id = ? FOR UPDATE', [quotationId]);
  if (rows.length === 0) throw httpError('Quotation not found', 404);
  return rows[0];
};

const addHistory = async (connection, quote, action, actedBy, remarks = null, approvalCode = null) => {
  await connection.execute(
    `INSERT INTO quotation_approval_history
      (quotation_id, quote_number, base_quote_number, vendor_id, action, approval_code, grand_total, remarks, acted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      quote.id,
      quote.quote_number || null,
      quote.base_quote_number || quote.quote_number || null,
      quote.vendor_id || null,
      action,
      approvalCode,
      quote.grand_total !== undefined && quote.grand_total !== null ? quote.grand_total : null,
      remarks,
      actedBy || null
    ]
  );
};

// QA-YYYY-MM-#### — atomic per-month counter (row-level lock via INSERT … ON DUPLICATE KEY UPDATE)
const generateApprovalCode = async (connection) => {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  await connection.query(
    `INSERT INTO quotation_approval_sequences (period, last_seq) VALUES (?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE last_seq = LAST_INSERT_ID(last_seq + 1)`,
    [period]
  );
  const [[row]] = await connection.query('SELECT LAST_INSERT_ID() AS seq');
  return `QA-${period}-${String(row.seq).padStart(4, '0')}`;
};

const assertHasPricedItems = async (connection, quotationId) => {
  const [[row]] = await connection.query(
    'SELECT COUNT(*) AS total, SUM(CASE WHEN unit_rate > 0 THEN 1 ELSE 0 END) AS priced FROM quotation_items WHERE quotation_id = ?',
    [quotationId]
  );
  if (!row.total) throw httpError('Quotation has no items. Record the vendor quotation before sending for approval.');
  if (!Number(row.priced)) throw httpError('Quotation items have no rates. Record the vendor rates before sending for approval.');
};

// Procurement: RECEIVED / REJECTED → PENDING_APPROVAL
const submitForApproval = async (quotationId, userId, remarks = null, existingConnection = null) => {
  const connection = existingConnection || await pool.getConnection();
  const manage = !existingConnection;
  try {
    if (manage) await connection.beginTransaction();

    const quote = await lockQuotation(connection, quotationId);
    if (!SUBMITTABLE_STATUSES.includes(quote.status)) {
      throw httpError(`Quotation ${quote.quote_number} is ${quote.status} and cannot be sent for approval. Only Received or Rejected quotations can be submitted.`);
    }
    await assertHasPricedItems(connection, quote.id);

    const [[prior]] = await connection.query(
      "SELECT COUNT(*) AS n FROM quotation_approval_history WHERE base_quote_number = ? AND action = 'REJECTED'",
      [quote.base_quote_number || quote.quote_number]
    );
    const action = (quote.status === 'REJECTED' || prior.n > 0) ? 'RESUBMITTED' : 'SUBMITTED';

    await connection.execute(
      `UPDATE quotations SET status = 'PENDING_APPROVAL', submitted_for_approval_by = ?, submitted_for_approval_at = NOW()
       WHERE id = ?`,
      [userId || null, quote.id]
    );
    await addHistory(connection, quote, action, userId, remarks || null);

    if (manage) await connection.commit();
    return { id: quote.id, quote_number: quote.quote_number, status: 'PENDING_APPROVAL', action };
  } catch (error) {
    if (manage) await connection.rollback();
    throw error;
  } finally {
    if (manage) connection.release();
  }
};

// Admin: PENDING_APPROVAL → REVIEWED + approval code. Does NOT create a Purchase Order.
const approveQuotation = async (quotationId, userId, remarks = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const quote = await lockQuotation(connection, quotationId);
    if (quote.status !== 'PENDING_APPROVAL') {
      throw httpError(`Quotation ${quote.quote_number} is ${quote.status}. Only quotations Pending Approval can be approved.`);
    }

    // Same item selection rule as the previous approval: if no item is awarded/selected, all items are selected
    const [[sel]] = await connection.query(
      'SELECT COUNT(*) AS n FROM quotation_items WHERE quotation_id = ? AND is_selected = 1',
      [quote.id]
    );
    if (!sel.n) {
      await connection.execute('UPDATE quotation_items SET is_selected = 1 WHERE quotation_id = ?', [quote.id]);
    }

    const approvalCode = await generateApprovalCode(connection);

    await connection.execute(
      `UPDATE quotations
       SET status = 'REVIEWED', approval_code = ?, approved_by = ?, approved_at = NOW(), approval_remarks = ?
       WHERE id = ? AND status = 'PENDING_APPROVAL'`,
      [approvalCode, userId || null, remarks || null, quote.id]
    );
    await addHistory(connection, quote, 'APPROVED', userId, remarks || null, approvalCode);

    await connection.commit();
    return { id: quote.id, quote_number: quote.quote_number, status: 'REVIEWED', approval_code: approvalCode };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Admin: PENDING_APPROVAL → REJECTED (reason required)
const rejectQuotation = async (quotationId, userId, reason) => {
  if (!reason || !String(reason).trim()) throw httpError('Rejection reason is required');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const quote = await lockQuotation(connection, quotationId);
    if (quote.status !== 'PENDING_APPROVAL') {
      throw httpError(`Quotation ${quote.quote_number} is ${quote.status}. Only quotations Pending Approval can be rejected here.`);
    }

    await connection.execute(
      "UPDATE quotations SET status = 'REJECTED', approval_remarks = ? WHERE id = ? AND status = 'PENDING_APPROVAL'",
      [String(reason).trim(), quote.id]
    );
    await addHistory(connection, quote, 'REJECTED', userId, String(reason).trim());

    await connection.commit();
    return { id: quote.id, quote_number: quote.quote_number, status: 'REJECTED' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Compare & Award: save the item awards, then send the awarded quotations for Admin approval (no approval, no PO)
const submitComparedForApproval = async ({ quotationIds, awards }, userId) => {
  if (!Array.isArray(quotationIds) || quotationIds.length === 0) throw httpError('Quotation IDs are required');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [locked] = await connection.query('SELECT id, quote_number, status FROM quotations WHERE id IN (?) FOR UPDATE', [quotationIds]);
    const blocked = locked.filter(q => ['PENDING_APPROVAL', 'REVIEWED'].includes(q.status));
    if (blocked.length > 0) {
      throw httpError(`Already ${blocked[0].status === 'REVIEWED' ? 'approved' : 'pending approval'}: ${blocked.map(q => q.quote_number).join(', ')}`);
    }

    await connection.query('UPDATE quotation_items SET is_selected = 0 WHERE quotation_id IN (?)', [quotationIds]);
    for (const award of (Array.isArray(awards) ? awards : [])) {
      if (!award || !award.quotationId || !award.itemCode) continue;
      await connection.execute(
        'UPDATE quotation_items SET is_selected = 1 WHERE quotation_id = ? AND (item_code = ? OR drawing_no = ?)',
        [award.quotationId, award.itemCode, award.itemCode]
      );
    }

    const submitted = [];
    for (const q of locked) {
      const [[sel]] = await connection.query(
        'SELECT COUNT(*) AS n FROM quotation_items WHERE quotation_id = ? AND is_selected = 1',
        [q.id]
      );
      if (sel.n > 0) {
        await submitForApproval(q.id, userId, 'Submitted from vendor comparison (awarded items)', connection);
        submitted.push(q.id);
      }
    }

    await connection.commit();
    return { submittedQuotationIds: submitted, approvedQuotationIds: [], createdPOs: [] };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const listApprovals = async ({ status = 'PENDING_APPROVAL', search = '' } = {}) => {
  const params = [];
  let where = "q.status <> 'SUPERSEDED'";
  if (status === 'PENDING_APPROVAL') {
    where += " AND q.status = 'PENDING_APPROVAL'";
  } else if (status === 'REVIEWED') {
    where += " AND q.status = 'REVIEWED' AND q.approval_code IS NOT NULL";
  } else if (status === 'REJECTED') {
    where += " AND q.status = 'REJECTED' AND EXISTS (SELECT 1 FROM quotation_approval_history h WHERE h.quotation_id = q.id AND h.action = 'REJECTED')";
  } else {
    where += " AND EXISTS (SELECT 1 FROM quotation_approval_history h WHERE h.quotation_id = q.id)";
  }
  if (search && String(search).trim()) {
    const like = `%${String(search).trim()}%`;
    where += ' AND (q.quote_number LIKE ? OR v.vendor_name LIKE ? OR mr.mr_number LIKE ? OR q.approval_code LIKE ? OR q.client_name LIKE ? OR q.project_name LIKE ?)';
    params.push(like, like, like, like, like, like);
  }

  const [rows] = await pool.query(
    `SELECT q.id, q.quote_number, q.base_quote_number, q.version, q.status, q.vendor_id, v.vendor_name,
            q.mr_id, mr.mr_number, q.rfq_id, q.rfq_group_id, q.client_name, q.project_name,
            q.total_amount, q.tax_amount, q.grand_total, q.gst_percentage, q.valid_until, q.received_pdf_path,
            q.approval_code, q.approval_remarks, q.approved_at, q.submitted_for_approval_at,
            ua.username AS approved_by_name, us.username AS submitted_by_name,
            (SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = q.id) AS items_count,
            (SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = q.id AND qi.is_selected = 1) AS selected_items_count,
            (SELECT po.po_number FROM purchase_orders po WHERE po.quotation_id = q.id ORDER BY po.id DESC LIMIT 1) AS po_number,
            (SELECT h.acted_at FROM quotation_approval_history h WHERE h.quotation_id = q.id AND h.action = 'REJECTED' ORDER BY h.id DESC LIMIT 1) AS rejected_at,
            (SELECT u.username FROM quotation_approval_history h JOIN users u ON u.id = h.acted_by WHERE h.quotation_id = q.id AND h.action = 'REJECTED' ORDER BY h.id DESC LIMIT 1) AS rejected_by_name
     FROM quotations q
     LEFT JOIN vendors v ON v.id = q.vendor_id
     LEFT JOIN material_requests mr ON mr.id = q.mr_id
     LEFT JOIN users ua ON ua.id = q.approved_by
     LEFT JOIN users us ON us.id = q.submitted_for_approval_by
     WHERE ${where}
     ORDER BY COALESCE(q.submitted_for_approval_at, q.updated_at, q.created_at) DESC
     LIMIT 500`,
    params
  );
  return rows;
};

const getHistory = async (quotationId) => {
  const [[q]] = await pool.query('SELECT base_quote_number, quote_number FROM quotations WHERE id = ?', [quotationId]);
  if (!q) throw httpError('Quotation not found', 404);
  const [rows] = await pool.query(
    `SELECT h.*, u.username AS acted_by_name
     FROM quotation_approval_history h
     LEFT JOIN users u ON u.id = h.acted_by
     WHERE h.quotation_id = ? OR h.base_quote_number = ?
     ORDER BY h.acted_at ASC, h.id ASC`,
    [quotationId, q.base_quote_number || q.quote_number]
  );
  return rows;
};

// Admin review: the quotation, its items, competing vendor quotations for the same RFQ / MR, and history
const getApprovalDetail = async (quotationId) => {
  const [[quote]] = await pool.query(
    `SELECT q.*, v.vendor_name, v.email AS vendor_email, mr.mr_number,
            ua.username AS approved_by_name, us.username AS submitted_by_name
     FROM quotations q
     LEFT JOIN vendors v ON v.id = q.vendor_id
     LEFT JOIN material_requests mr ON mr.id = q.mr_id
     LEFT JOIN users ua ON ua.id = q.approved_by
     LEFT JOIN users us ON us.id = q.submitted_for_approval_by
     WHERE q.id = ?`,
    [quotationId]
  );
  if (!quote) throw httpError('Quotation not found', 404);

  const [items] = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id', [quote.id]);

  let compareWhere = null;
  let compareParams = [];
  if (quote.rfq_group_id) { compareWhere = 'q.rfq_group_id = ?'; compareParams = [quote.rfq_group_id]; }
  else if (quote.rfq_id) { compareWhere = 'q.rfq_id = ?'; compareParams = [quote.rfq_id]; }
  else if (quote.mr_id) { compareWhere = 'q.mr_id = ?'; compareParams = [quote.mr_id]; }

  let competitors = [];
  if (compareWhere) {
    const [others] = await pool.query(
      `SELECT q.id, q.quote_number, q.status, q.grand_total, q.total_amount, q.vendor_id, v.vendor_name
       FROM quotations q LEFT JOIN vendors v ON v.id = q.vendor_id
       WHERE ${compareWhere} AND q.id <> ? AND q.status IN ('RECEIVED','PENDING_APPROVAL','REVIEWED','REJECTED')`,
      [...compareParams, quote.id]
    );
    if (others.length > 0) {
      const [otherItems] = await pool.query(
        'SELECT quotation_id, item_code, drawing_no, description, material_name, quantity, unit_rate, amount, total_amount FROM quotation_items WHERE quotation_id IN (?)',
        [others.map(o => o.id)]
      );
      competitors = others.map(o => ({ ...o, items: otherItems.filter(i => i.quotation_id === o.id) }));
    }
  }

  const history = await getHistory(quote.id);
  return { ...quote, items, competitors, history };
};

const getPendingCount = async () => {
  const [[row]] = await pool.query(
    "SELECT COUNT(*) AS count, COALESCE(SUM(grand_total), 0) AS total_value FROM quotations WHERE status = 'PENDING_APPROVAL'"
  );
  return { count: Number(row.count) || 0, totalValue: Number(row.total_value) || 0 };
};

module.exports = {
  submitForApproval,
  approveQuotation,
  rejectQuotation,
  submitComparedForApproval,
  listApprovals,
  getApprovalDetail,
  getHistory,
  getPendingCount
};
