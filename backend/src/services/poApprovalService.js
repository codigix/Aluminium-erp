// Purchase Order → Admin approval workflow.
//
//   DRAFT / PO_REQUEST (vendor assigned) --submitForApproval--> PENDING_APPROVAL
//   PENDING_APPROVAL --approve (Admin)--> ORDERED + unique PO approval code (PA-YYYY-MM-####)
//   PENDING_APPROVAL --reject (Admin, reason required)--> DRAFT (Procurement edits and resubmits)
//
//   Commercial change (vendor / items / qty / rate / GST / discount) on an approved, not yet received PO
//   --> back to DRAFT (approval code withdrawn, kept in history) → needs re-approval.
//   Commercial change on a received / accounted / paid PO --> refused.
//
// Approval never sends the vendor email; sending stays a separate Procurement action, allowed only after approval.
const pool = require('../config/db');

const httpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  return error;
};

// Not yet Admin-approved: no vendor email, no GRN, no Accounts, no Ordered/Sent status via plain edits
const UNAPPROVED_STATUSES = ['DRAFT', 'PO_REQUEST', 'PENDING_APPROVAL'];
// Approved but nothing received / accounted yet: commercial edits send the PO back for re-approval
const APPROVED_OPEN_STATUSES = ['ORDERED', 'SENT', 'ACKNOWLEDGED', 'APPROVED'];
// Received, accounted, paid, closed or merged: commercial edits are refused
const COMMERCIAL_LOCKED_STATUSES = ['PARTIALLY_RECEIVED', 'RECEIVED', 'FULFILLED', 'COMPLETED', 'CLOSED', 'PENDING_PAYMENT', 'PAID', 'MERGED'];

const lockPO = async (connection, poId) => {
  const [rows] = await connection.query('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE', [poId]);
  if (rows.length === 0) throw httpError('Purchase Order not found', 404);
  return rows[0];
};

// Commercial terms of a PO (vendor, discount, items with qty / rate / GST) — notes and dates are excluded
const getCommercialSnapshot = async (connection, poId) => {
  const [[po]] = await connection.query(
    'SELECT vendor_id, discount_type, discount_value, total_amount FROM purchase_orders WHERE id = ?',
    [poId]
  );
  const [items] = await connection.query(
    `SELECT item_code, drawing_no, material_name, quantity, design_qty, unit, unit_rate, cgst_percent, sgst_percent
     FROM purchase_order_items WHERE purchase_order_id = ?`,
    [poId]
  );
  const num = (v) => Number(Number(v || 0).toFixed(4));
  const normItems = items
    .map(i => ({
      item: String(i.item_code || i.drawing_no || i.material_name || '').trim().toUpperCase(),
      qty: num(i.quantity),
      design_qty: num(i.design_qty),
      unit: String(i.unit || '').toUpperCase(),
      rate: num(i.unit_rate),
      cgst: num(i.cgst_percent),
      sgst: num(i.sgst_percent)
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    vendor_id: po ? (po.vendor_id || null) : null,
    discount_type: po ? (po.discount_type || 'AMOUNT') : 'AMOUNT',
    discount_value: po ? num(po.discount_value) : 0,
    total_amount: po ? num(po.total_amount) : 0,
    items: normItems
  };
};

// Fields compared to decide "commercial terms changed". Only values the edit form stores verbatim are compared
// (qty and rate per line, line count, vendor, discount) so re-saving an unchanged PO is not treated as a change.
const commercialKey = (snap) => JSON.stringify({
  vendor_id: snap.vendor_id ? Number(snap.vendor_id) : null,
  discount_type: snap.discount_type,
  discount_value: snap.discount_value,
  lines: snap.items.map(i => [i.qty, i.rate]).sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]))
});

const addHistory = async (connection, po, action, actedBy, remarks = null, approvalCode = null, snapshot = null) => {
  await connection.execute(
    `INSERT INTO po_approval_history (po_id, po_number, vendor_id, action, approval_code, total_amount, remarks, snapshot, acted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      po.id,
      po.po_number || null,
      po.vendor_id || null,
      action,
      approvalCode,
      po.total_amount !== undefined && po.total_amount !== null ? po.total_amount : null,
      remarks,
      snapshot ? JSON.stringify(snapshot) : null,
      actedBy || null
    ]
  );
};

// PA-YYYY-MM-#### — atomic per-month counter; the unique index on po_approval_code is the final guard
const generateApprovalCode = async (connection) => {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  await connection.query(
    `INSERT INTO po_approval_sequences (period, last_seq) VALUES (?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE last_seq = LAST_INSERT_ID(last_seq + 1)`,
    [period]
  );
  const [[row]] = await connection.query('SELECT LAST_INSERT_ID() AS seq');
  return `PA-${period}-${String(row.seq).padStart(4, '0')}`;
};

// Procurement: DRAFT / PO_REQUEST → PENDING_APPROVAL
const submitForApproval = async (poId, userId, remarks = null, existingConnection = null) => {
  const connection = existingConnection || await pool.getConnection();
  const manage = !existingConnection;
  try {
    if (manage) await connection.beginTransaction();

    const po = await lockPO(connection, poId);
    if (po.status === 'PENDING_APPROVAL') {
      throw httpError(`Purchase Order ${po.po_number} is already pending Admin approval.`);
    }
    if (!['DRAFT', 'PO_REQUEST'].includes(po.status)) {
      throw httpError(`Purchase Order ${po.po_number} is ${po.status} and cannot be sent for approval. Only Draft POs can be submitted.`);
    }
    if (!po.vendor_id) {
      throw httpError(`Assign a vendor to ${po.po_number} before sending it for approval.`);
    }
    const [[cnt]] = await connection.query(
      'SELECT COUNT(*) AS n FROM purchase_order_items WHERE purchase_order_id = ?',
      [po.id]
    );
    if (!cnt.n) throw httpError(`Purchase Order ${po.po_number} has no items.`);

    const [[prior]] = await connection.query(
      "SELECT COUNT(*) AS n FROM po_approval_history WHERE po_id = ? AND action IN ('REJECTED','REVISED')",
      [po.id]
    );
    const action = prior.n > 0 ? 'RESUBMITTED' : 'SUBMITTED';

    await connection.execute(
      `UPDATE purchase_orders
       SET status = 'PENDING_APPROVAL', submitted_for_approval_by = ?, submitted_for_approval_at = NOW()
       WHERE id = ? AND status IN ('DRAFT','PO_REQUEST')`,
      [userId || null, po.id]
    );
    await addHistory(connection, po, action, userId, remarks || null, null, await getCommercialSnapshot(connection, po.id));

    if (manage) await connection.commit();
    return { id: po.id, po_number: po.po_number, status: 'PENDING_APPROVAL', action };
  } catch (error) {
    if (manage) await connection.rollback();
    throw error;
  } finally {
    if (manage) connection.release();
  }
};

const bulkSubmitForApproval = async (poIds, userId, remarks = null) => {
  const submitted = [];
  const failed = [];
  for (const poId of poIds) {
    try {
      submitted.push(await submitForApproval(poId, userId, remarks));
    } catch (err) {
      failed.push({ poId, reason: err.message });
    }
  }
  return {
    message: `${submitted.length} Purchase Order${submitted.length === 1 ? '' : 's'} sent for Admin approval`,
    submitted,
    failed,
    total: poIds.length
  };
};

// Admin: PENDING_APPROVAL → ORDERED + PA code (same side effects as the previous approval: approved_by/at, MR → PO_CREATED)
const approvePurchaseOrder = async (poId, userId, remarks = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const po = await lockPO(connection, poId);
    if (po.status !== 'PENDING_APPROVAL') {
      throw httpError(`Purchase Order ${po.po_number} is ${po.status}. Only POs Pending Approval can be approved.`);
    }
    if (!po.vendor_id) {
      throw httpError('Cannot approve PO without a vendor. Please edit the PO to assign a vendor first.');
    }

    const approvalCode = await generateApprovalCode(connection);
    const [res] = await connection.execute(
      `UPDATE purchase_orders
       SET status = 'ORDERED', approved_by = ?, approved_at = NOW(), po_approval_code = ?, po_approval_remarks = ?
       WHERE id = ? AND status = 'PENDING_APPROVAL'`,
      [userId || null, approvalCode, remarks || null, po.id]
    );
    if (!res.affectedRows) throw httpError(`Purchase Order ${po.po_number} was already processed.`, 409);

    if (po.mr_id) {
      await connection.execute("UPDATE material_requests SET status = 'PO_CREATED' WHERE id = ?", [po.mr_id]);
    }
    await addHistory(connection, po, 'APPROVED', userId, remarks || null, approvalCode, await getCommercialSnapshot(connection, po.id));

    await connection.commit();
    return { success: true, poId: po.id, po_number: po.po_number, status: 'ORDERED', approval_code: approvalCode };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const bulkApprovePurchaseOrders = async (poIds, userId, remarks = null) => {
  const approved = [];
  const failed = [];
  for (const poId of poIds) {
    try {
      approved.push(await approvePurchaseOrder(poId, userId, remarks));
    } catch (err) {
      failed.push({ poId, reason: err.message });
    }
  }
  return {
    message: `${approved.length} Purchase Order${approved.length === 1 ? '' : 's'} approved successfully`,
    approved,
    failed,
    total: poIds.length
  };
};

// Admin: PENDING_APPROVAL → DRAFT with mandatory remarks
const rejectPurchaseOrder = async (poId, userId, reason) => {
  if (!reason || !String(reason).trim()) throw httpError('Rejection remarks are required');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const po = await lockPO(connection, poId);
    if (po.status !== 'PENDING_APPROVAL') {
      throw httpError(`Purchase Order ${po.po_number} is ${po.status}. Only POs Pending Approval can be rejected.`);
    }
    await connection.execute(
      "UPDATE purchase_orders SET status = 'DRAFT', po_approval_remarks = ? WHERE id = ? AND status = 'PENDING_APPROVAL'",
      [String(reason).trim(), po.id]
    );
    await addHistory(connection, po, 'REJECTED', userId, String(reason).trim());

    await connection.commit();
    return { id: po.id, po_number: po.po_number, status: 'DRAFT', rejected: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// ---- Guards used by purchaseOrderService (same transaction as the edit) ----

const assertApprovedForAction = (po, actionLabel) => {
  if (po && UNAPPROVED_STATUSES.includes(po.status)) {
    throw httpError(
      po.status === 'PENDING_APPROVAL'
        ? `Purchase Order ${po.po_number} is pending Admin approval. ${actionLabel} is allowed only after approval.`
        : `Purchase Order ${po.po_number} is not approved yet. Send it for Admin approval first; ${actionLabel.toLowerCase()} is allowed only after approval.`,
      403
    );
  }
};

const isCommercialLocked = async (connection, po) => {
  if (COMMERCIAL_LOCKED_STATUSES.includes(po.status)) return true;
  if (Number(po.forwarded_to_accounts) === 1) return true;
  const [[r]] = await connection.query('SELECT COUNT(*) AS n FROM po_receipts WHERE po_id = ?', [po.id]);
  return r.n > 0;
};

// Called after an edit has been applied (inside its transaction).
//   approved & open + commercial change → back to DRAFT, approval withdrawn, REVISED history
//   received / accounted + commercial change → refused (caller rolls back)
const applyRevisionRules = async (connection, existingPo, beforeSnapshot, userId) => {
  if (UNAPPROVED_STATUSES.includes(existingPo.status)) return { revised: false };
  const afterSnapshot = await getCommercialSnapshot(connection, existingPo.id);
  if (commercialKey(beforeSnapshot) === commercialKey(afterSnapshot)) return { revised: false };

  if (await isCommercialLocked(connection, existingPo)) {
    throw httpError(
      `Purchase Order ${existingPo.po_number} is ${existingPo.status}${Number(existingPo.forwarded_to_accounts) === 1 ? ' and forwarded to Accounts' : ''}. ` +
      'Vendor, items, quantities, rates, GST and discount can no longer be changed. Only notes and dates can be edited.',
      400
    );
  }
  if (!APPROVED_OPEN_STATUSES.includes(existingPo.status)) return { revised: false };

  await connection.execute(
    `UPDATE purchase_orders
     SET status = 'DRAFT', po_approval_code = NULL, approved_by = NULL, approved_at = NULL,
         po_approval_remarks = 'Commercial terms changed after approval — re-approval required'
     WHERE id = ?`,
    [existingPo.id]
  );
  await addHistory(
    connection,
    { ...existingPo, total_amount: afterSnapshot.total_amount },
    'REVISED',
    userId,
    `Commercial terms changed after approval${existingPo.po_approval_code ? ` (approval ${existingPo.po_approval_code} withdrawn)` : ''}. Re-approval required.`,
    existingPo.po_approval_code || null,
    { before: beforeSnapshot, after: afterSnapshot }
  );
  return { revised: true };
};

// ---- Read side ----

const listApprovals = async ({ status = 'PENDING_APPROVAL', search = '' } = {}) => {
  const params = [];
  let where = '1=1';
  if (status === 'PENDING_APPROVAL') {
    where += " AND po.status = 'PENDING_APPROVAL'";
  } else if (status === 'APPROVED') {
    where += ' AND po.po_approval_code IS NOT NULL';
  } else if (status === 'REJECTED') {
    where += ` AND po.status = 'DRAFT' AND (SELECT h.action FROM po_approval_history h WHERE h.po_id = po.id ORDER BY h.id DESC LIMIT 1) = 'REJECTED'`;
  } else {
    where += ' AND EXISTS (SELECT 1 FROM po_approval_history h WHERE h.po_id = po.id)';
  }
  if (search && String(search).trim()) {
    const like = `%${String(search).trim()}%`;
    where += ' AND (po.po_number LIKE ? OR v.vendor_name LIKE ? OR mr.mr_number LIKE ? OR po.po_approval_code LIKE ? OR q.quote_number LIKE ? OR po.quotation_approval_code LIKE ?)';
    params.push(like, like, like, like, like, like);
  }

  const [rows] = await pool.query(
    `SELECT po.id, po.po_number, po.status, po.po_type, po.is_merged, po.vendor_id, v.vendor_name,
            po.mr_id, mr.mr_number, po.quotation_id, q.quote_number,
            COALESCE(po.quotation_approval_code, q.approval_code) AS quotation_approval_code,
            po.total_amount, po.expected_delivery_date, po.created_at,
            po.po_approval_code, po.po_approval_remarks, po.approved_at, po.submitted_for_approval_at,
            ua.username AS approved_by_name, us.username AS submitted_by_name,
            (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id) AS items_count,
            (SELECT h.acted_at FROM po_approval_history h WHERE h.po_id = po.id AND h.action = 'REJECTED' ORDER BY h.id DESC LIMIT 1) AS rejected_at,
            (SELECT u.username FROM po_approval_history h JOIN users u ON u.id = h.acted_by WHERE h.po_id = po.id AND h.action = 'REJECTED' ORDER BY h.id DESC LIMIT 1) AS rejected_by_name
     FROM purchase_orders po
     LEFT JOIN vendors v ON v.id = po.vendor_id
     LEFT JOIN material_requests mr ON mr.id = po.mr_id
     LEFT JOIN quotations q ON q.id = po.quotation_id
     LEFT JOIN users ua ON ua.id = po.approved_by
     LEFT JOIN users us ON us.id = po.submitted_for_approval_by
     WHERE ${where}
     ORDER BY COALESCE(po.submitted_for_approval_at, po.updated_at, po.created_at) DESC
     LIMIT 500`,
    params
  );
  return rows;
};

const getHistory = async (poId) => {
  const [rows] = await pool.query(
    `SELECT h.id, h.po_id, h.po_number, h.action, h.approval_code, h.total_amount, h.remarks, h.acted_at, h.acted_by,
            u.username AS acted_by_name
     FROM po_approval_history h
     LEFT JOIN users u ON u.id = h.acted_by
     WHERE h.po_id = ?
     ORDER BY h.acted_at ASC, h.id ASC`,
    [poId]
  );
  return rows;
};

const getApprovalDetail = async (poId) => {
  const purchaseOrderService = require('./purchaseOrderService');
  const po = await purchaseOrderService.getPurchaseOrderById(poId);
  if (!po) throw httpError('Purchase Order not found', 404);

  const [[extra]] = await pool.query(
    `SELECT po.po_approval_code, po.po_approval_remarks, po.approved_at, po.submitted_for_approval_at,
            COALESCE(po.quotation_approval_code, q.approval_code) AS quotation_approval_code, q.quote_number,
            ua.username AS approved_by_name, us.username AS submitted_by_name, mr.mr_number
     FROM purchase_orders po
     LEFT JOIN quotations q ON q.id = po.quotation_id
     LEFT JOIN users ua ON ua.id = po.approved_by
     LEFT JOIN users us ON us.id = po.submitted_for_approval_by
     LEFT JOIN material_requests mr ON mr.id = po.mr_id
     WHERE po.id = ?`,
    [poId]
  );
  const history = await getHistory(poId);
  return { ...po, ...(extra || {}), history };
};

const getPendingCount = async () => {
  const [[row]] = await pool.query(
    "SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_value FROM purchase_orders WHERE status = 'PENDING_APPROVAL'"
  );
  return { count: Number(row.count) || 0, totalValue: Number(row.total_value) || 0 };
};

module.exports = {
  UNAPPROVED_STATUSES,
  APPROVED_OPEN_STATUSES,
  COMMERCIAL_LOCKED_STATUSES,
  httpError,
  submitForApproval,
  bulkSubmitForApproval,
  approvePurchaseOrder,
  bulkApprovePurchaseOrders,
  rejectPurchaseOrder,
  assertApprovedForAction,
  getCommercialSnapshot,
  applyRevisionRules,
  listApprovals,
  getHistory,
  getApprovalDetail,
  getPendingCount
};
