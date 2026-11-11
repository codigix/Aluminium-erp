// Sales Order (orders table) issuing company → change only through Admin approval.
//
// Applies to Sales Orders linked to a Customer PO (orders.source_type = 'DIRECT', orders.quotation_id = customer_pos.id).
//   - The Sales Order always starts with the Customer PO's company (customer_pos.host_company_id).
//   - Sales submits a change request (reason required, one PENDING per order, refused when an invoice exists).
//   - Admin approves → orders.host_company_id updated, audit history with both company snapshots.
//   - Admin rejects (remarks required) → company unchanged; Sales may submit a new request.
// The Customer PO company is never modified. Invoices are never modified.
const pool = require('../config/db');

const httpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  return error;
};

// Linked Customer PO for an order row (same rule the Sales Order list uses for its client / PO number)
const getLinkedCustomerPo = async (connection, order) => {
  if (!order || order.source_type !== 'DIRECT' || !order.quotation_id) return null;
  const [rows] = await connection.query(
    'SELECT id, po_number, host_company_id FROM customer_pos WHERE id = ?',
    [order.quotation_id]
  );
  return rows[0] || null;
};

const getCompany = async (connection, companyId) => {
  if (!companyId) return null;
  const [rows] = await connection.query(
    `SELECT id, company_name, company_address, gstin, pan, bank_name, account_number, ifsc_code, branch_name, status
     FROM company_master WHERE id = ?`,
    [companyId]
  );
  return rows[0] || null;
};

// Invoices already raised against this Sales Order (any invoice blocks a silent company change)
const getInvoices = async (connection, orderId) => {
  const [rows] = await connection.query(
    'SELECT id, invoice_no, status, host_company_id FROM sales_invoices WHERE order_id = ? ORDER BY id',
    [orderId]
  );
  return rows;
};

const lockOrder = async (connection, orderId) => {
  const [rows] = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
  if (!rows.length) throw httpError('Sales Order not found', 404);
  return rows[0];
};

// ---- Guards used by orderService (create / update) ----

// Company to store on a new Sales Order: the linked Customer PO's company wins over anything sent by the client
const resolveCompanyForNewOrder = async (connection, { source_type, quotation_id, host_company_id }) => {
  const cpo = await getLinkedCustomerPo(connection, { source_type: source_type || 'DIRECT', quotation_id });
  if (cpo && cpo.host_company_id) return cpo.host_company_id;
  return host_company_id || null;
};

// Company to store on an updated Sales Order. Linked orders: the stored company is kept; a different value is refused.
const resolveCompanyForUpdate = async (connection, existingOrder, incoming) => {
  const nextSourceType = incoming.source_type || 'DIRECT';
  const nextQuotationId = incoming.quotation_id || null;
  const cpo = await getLinkedCustomerPo(connection, { source_type: nextSourceType, quotation_id: nextQuotationId });
  if (!cpo) return incoming.host_company_id || null; // Direct / Sales-Quotation orders: unchanged behaviour

  const sameLink = existingOrder.source_type === nextSourceType && String(existingOrder.quotation_id || '') === String(nextQuotationId || '');
  // Re-linked to a different Customer PO → take that PO's company; otherwise keep the approved company
  const locked = sameLink ? (existingOrder.host_company_id || cpo.host_company_id || null) : (cpo.host_company_id || null);
  const requested = incoming.host_company_id ? Number(incoming.host_company_id) : null;
  if (requested && locked && requested !== Number(locked)) {
    throw httpError(
      `The issuing company of this Sales Order is locked to Customer PO ${cpo.po_number}. Use "Request Company Change" — the change needs Admin approval.`,
      403
    );
  }
  return locked || requested || null;
};

// ---- Sales: submit ----

const submitRequest = async ({ orderId, requestedCompanyId, reason }, userId) => {
  if (!reason || !String(reason).trim()) throw httpError('Reason for the company change is required');
  if (!requestedCompanyId) throw httpError('Select the requested company');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const order = await lockOrder(connection, orderId);
    const cpo = await getLinkedCustomerPo(connection, order);
    if (!cpo) throw httpError('Company change approval applies only to Sales Orders created from a Customer PO. This order can be edited directly.');

    const invoices = await getInvoices(connection, order.id);
    if (invoices.length) {
      throw httpError(`Invoice ${invoices.map(i => i.invoice_no || `#${i.id}`).join(', ')} already exists for this Sales Order. The issuing company cannot be changed here; use a controlled invoice correction.`);
    }

    const [pending] = await connection.query(
      "SELECT id FROM company_change_requests WHERE order_id = ? AND status = 'PENDING' FOR UPDATE",
      [order.id]
    );
    if (pending.length) throw httpError('A company change request for this Sales Order is already pending Admin approval.');

    const requested = await getCompany(connection, requestedCompanyId);
    if (!requested) throw httpError('Requested company not found in Company Master', 404);
    const currentId = order.host_company_id || cpo.host_company_id || null;
    if (currentId && Number(currentId) === Number(requested.id)) throw httpError('The Sales Order already uses this company.');
    const current = await getCompany(connection, currentId);

    const [res] = await connection.execute(
      `INSERT INTO company_change_requests
        (order_id, order_no, customer_po_id, customer_po_number, current_company_id, current_company_name,
         requested_company_id, requested_company_name, reason, status, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [order.id, order.order_no || null, cpo.id, cpo.po_number || null, currentId, current ? current.company_name : null,
        requested.id, requested.company_name, String(reason).trim(), userId || null]
    );

    await connection.commit();
    return { id: res.insertId, status: 'PENDING' };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw httpError('A company change request for this Sales Order is already pending Admin approval.');
    throw error;
  } finally {
    connection.release();
  }
};

const lockRequest = async (connection, requestId) => {
  const [rows] = await connection.query('SELECT * FROM company_change_requests WHERE id = ? FOR UPDATE', [requestId]);
  if (!rows.length) throw httpError('Company change request not found', 404);
  return rows[0];
};

// ---- Admin: approve / reject ----

const approveRequest = async (requestId, adminId, remarks = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const req = await lockRequest(connection, requestId);
    if (req.status !== 'PENDING') throw httpError(`This request is already ${req.status}.`);

    const order = await lockOrder(connection, req.order_id);
    const invoices = await getInvoices(connection, order.id);
    if (invoices.length) {
      throw httpError(`Invoice ${invoices.map(i => i.invoice_no || `#${i.id}`).join(', ')} was created for this Sales Order after the request. Reject this request; the invoice needs a controlled correction.`);
    }

    const newCompany = await getCompany(connection, req.requested_company_id);
    if (!newCompany) throw httpError('Requested company no longer exists in Company Master', 404);
    const oldCompany = await getCompany(connection, order.host_company_id);

    await connection.execute('UPDATE orders SET host_company_id = ?, updated_at = NOW() WHERE id = ?', [newCompany.id, order.id]);
    await connection.execute(
      `UPDATE company_change_requests SET status = 'APPROVED', decided_by = ?, decided_at = NOW(), decision_remarks = ?
       WHERE id = ? AND status = 'PENDING'`,
      [adminId || null, remarks || null, req.id]
    );
    await connection.execute(
      `INSERT INTO company_change_history
        (request_id, order_id, order_no, customer_po_id, old_company_id, new_company_id, old_company_snapshot, new_company_snapshot, changed_by, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.id, order.id, order.order_no || null, req.customer_po_id, order.host_company_id || null, newCompany.id,
        oldCompany ? JSON.stringify(oldCompany) : null, JSON.stringify(newCompany), adminId || null, remarks || req.reason]
    );

    await connection.commit();
    return { id: req.id, status: 'APPROVED', order_id: order.id, host_company_id: newCompany.id, company_name: newCompany.company_name };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const rejectRequest = async (requestId, adminId, remarks) => {
  if (!remarks || !String(remarks).trim()) throw httpError('Rejection remarks are required');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const req = await lockRequest(connection, requestId);
    if (req.status !== 'PENDING') throw httpError(`This request is already ${req.status}.`);
    await connection.execute(
      `UPDATE company_change_requests SET status = 'REJECTED', decided_by = ?, decided_at = NOW(), decision_remarks = ?
       WHERE id = ? AND status = 'PENDING'`,
      [adminId || null, String(remarks).trim(), req.id]
    );
    await connection.commit();
    return { id: req.id, status: 'REJECTED' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// ---- Read side ----

const REQUEST_SELECT = `
  SELECT r.*, ur.username AS requested_by_name, ud.username AS decided_by_name,
         cc.company_name AS current_company_live_name, cc.gstin AS current_gstin, cc.pan AS current_pan,
         cc.company_address AS current_address, cc.bank_name AS current_bank_name, cc.account_number AS current_account_number, cc.ifsc_code AS current_ifsc,
         rc.company_name AS requested_company_live_name, rc.gstin AS requested_gstin, rc.pan AS requested_pan,
         rc.company_address AS requested_address, rc.bank_name AS requested_bank_name, rc.account_number AS requested_account_number, rc.ifsc_code AS requested_ifsc,
         o.host_company_id AS order_current_company_id, o.project_name, o.grand_total,
         (SELECT COUNT(*) FROM sales_invoices si WHERE si.order_id = r.order_id) AS invoice_count
  FROM company_change_requests r
  LEFT JOIN users ur ON ur.id = r.requested_by
  LEFT JOIN users ud ON ud.id = r.decided_by
  LEFT JOIN company_master cc ON cc.id = r.current_company_id
  LEFT JOIN company_master rc ON rc.id = r.requested_company_id
  LEFT JOIN orders o ON o.id = r.order_id`;

const listRequests = async ({ status = 'PENDING', search = '' } = {}) => {
  const params = [];
  let where = '1=1';
  if (['PENDING', 'APPROVED', 'REJECTED'].includes(status)) { where += ' AND r.status = ?'; params.push(status); }
  if (search && String(search).trim()) {
    const like = `%${String(search).trim()}%`;
    where += ' AND (r.order_no LIKE ? OR r.customer_po_number LIKE ? OR r.current_company_name LIKE ? OR r.requested_company_name LIKE ? OR o.project_name LIKE ?)';
    params.push(like, like, like, like, like);
  }
  const [rows] = await pool.query(`${REQUEST_SELECT} WHERE ${where} ORDER BY r.requested_at DESC, r.id DESC LIMIT 500`, params);
  return rows;
};

const getOrderHistory = async (orderId) => {
  const [rows] = await pool.query(
    `SELECT h.id, h.request_id, h.order_id, h.order_no, h.old_company_id, h.new_company_id, h.changed_at, h.remarks,
            JSON_UNQUOTE(JSON_EXTRACT(h.old_company_snapshot, '$.company_name')) AS old_company_name,
            JSON_UNQUOTE(JSON_EXTRACT(h.old_company_snapshot, '$.gstin')) AS old_gstin,
            JSON_UNQUOTE(JSON_EXTRACT(h.new_company_snapshot, '$.company_name')) AS new_company_name,
            JSON_UNQUOTE(JSON_EXTRACT(h.new_company_snapshot, '$.gstin')) AS new_gstin,
            u.username AS changed_by_name
     FROM company_change_history h LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.order_id = ? ORDER BY h.changed_at ASC, h.id ASC`,
    [orderId]
  );
  return rows;
};

const getRequestDetail = async (requestId) => {
  const [rows] = await pool.query(`${REQUEST_SELECT} WHERE r.id = ?`, [requestId]);
  if (!rows.length) throw httpError('Company change request not found', 404);
  const [requests] = await pool.query(
    `SELECT r.id, r.status, r.current_company_name, r.requested_company_name, r.reason, r.requested_at, r.decided_at, r.decision_remarks,
            ur.username AS requested_by_name, ud.username AS decided_by_name
     FROM company_change_requests r LEFT JOIN users ur ON ur.id = r.requested_by LEFT JOIN users ud ON ud.id = r.decided_by
     WHERE r.order_id = ? ORDER BY r.id ASC`,
    [rows[0].order_id]
  );
  return { ...rows[0], requests, history: await getOrderHistory(rows[0].order_id) };
};

// Sales Order screen: is the company locked, by which Customer PO, and what is the latest request?
const getOrderCompanyStatus = async (orderId, userId = null) => {
  const [orders] = await pool.query('SELECT id, order_no, source_type, quotation_id, host_company_id FROM orders WHERE id = ?', [orderId]);
  if (!orders.length) throw httpError('Sales Order not found', 404);
  const order = orders[0];
  const cpo = await getLinkedCustomerPo(pool, order);
  const company = await getCompany(pool, order.host_company_id || (cpo && cpo.host_company_id));
  const cpoCompany = cpo ? await getCompany(pool, cpo.host_company_id) : null;
  const invoices = await getInvoices(pool, order.id);
  const [requests] = await pool.query(
    `SELECT r.*, ur.username AS requested_by_name, ud.username AS decided_by_name
     FROM company_change_requests r LEFT JOIN users ur ON ur.id = r.requested_by LEFT JOIN users ud ON ud.id = r.decided_by
     WHERE r.order_id = ? ORDER BY r.id DESC`,
    [order.id]
  );
  const latest = requests[0] || null;
  // One-time notice for the requester once Admin has decided
  const unseenDecision = latest && latest.status !== 'PENDING' && !latest.requester_notified_at && userId && Number(latest.requested_by) === Number(userId)
    ? latest : null;
  return {
    order_id: order.id,
    order_no: order.order_no,
    locked: Boolean(cpo),
    customer_po: cpo ? { id: cpo.id, po_number: cpo.po_number, host_company_id: cpo.host_company_id, company_name: cpoCompany ? cpoCompany.company_name : null } : null,
    company,
    invoices: invoices.map(i => ({ id: i.id, invoice_no: i.invoice_no, status: i.status })),
    pending: requests.find(r => r.status === 'PENDING') || null,
    latest,
    unseen_decision: unseenDecision,
    requests,
    history: await getOrderHistory(order.id)
  };
};

// Resolve the Sales Order (and its approved issuing company) behind a procurement / inventory / QC document:
//   GRN (po_receipts.id or grns.id) → Purchase Order → Material Request → production plan → Sales Order
const resolveSource = async ({ mrId, poId, receiptId, grnId } = {}, userId = null) => {
  let mr = mrId ? Number(mrId) : null;
  let po = poId ? Number(poId) : null;
  if (!po && receiptId) {
    const [[r]] = await pool.query('SELECT po_id FROM po_receipts WHERE id = ?', [receiptId]);
    po = r ? r.po_id : null;
  }
  if (!po && grnId) {
    const [[g]] = await pool.query('SELECT po.id FROM grns g JOIN purchase_orders po ON po.po_number = g.po_number WHERE g.id = ? LIMIT 1', [grnId]);
    po = g ? g.id : null;
  }
  if (!mr && po) {
    const [[p]] = await pool.query(
      'SELECT COALESCE(po.mr_id, q.mr_id) AS mr_id FROM purchase_orders po LEFT JOIN quotations q ON q.id = po.quotation_id WHERE po.id = ?',
      [po]
    );
    mr = p ? p.mr_id : null;
  }
  if (!mr) return { found: false };

  const [[mrRow]] = await pool.query('SELECT id, mr_number, plan_id FROM material_requests WHERE id = ?', [mr]);
  if (!mrRow) return { found: false };
  const link = await resolvePlanOrder(mrRow.plan_id);
  if (!link || !link.company_id) return { found: false, mr_id: mrRow.id, mr_number: mrRow.mr_number };

  const company = await getCompany(pool, link.company_id);
  // Only Sales Orders in the current Sales Order module (orders table) use the change-request approval
  const status = link.kind === 'ORDER' ? await getOrderCompanyStatus(link.order_id, userId) : null;
  return {
    found: true,
    kind: link.kind,
    mr_id: mrRow.id,
    mr_number: mrRow.mr_number,
    po_id: po,
    order_id: link.kind === 'ORDER' ? link.order_id : null,
    order_no: link.order_no,
    customer_po_number: link.customer_po_number || null,
    company_id: link.company_id,
    company_name: company ? company.company_name : null,
    company,
    status
  };
};

// Sales Order behind a production plan. Plans reference either the current `orders` table or the older
// `sales_orders` table and the two id ranges overlap, so the plan item is matched against each table's
// item rows (order_items / sales_order_items) to tell them apart.
const resolvePlanOrder = async (planId) => {
  if (!planId) return null;

  // 1. Older Sales Order module: the plan item's sales_order_item_id AND sales_order_id both match sales_order_items
  const [[legacy]] = await pool.query(
    `SELECT so.id AS order_id, CONCAT('SO-', LPAD(so.id, 4, '0')) AS order_no,
            COALESCE(so.host_company_id, cp.host_company_id) AS company_id, cp.po_number AS customer_po_number
     FROM production_plan_items ppi
     JOIN sales_order_items soi ON soi.id = ppi.sales_order_item_id AND soi.sales_order_id = ppi.sales_order_id
     JOIN sales_orders so ON so.id = soi.sales_order_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     WHERE ppi.plan_id = ?
     ORDER BY ppi.id LIMIT 1`,
    [planId]
  );
  if (legacy) return { kind: 'LEGACY', ...legacy };

  // 2. Current Sales Order module (orders): the order must really contain the plan's drawing / item
  const [[current]] = await pool.query(
    `SELECT o.id AS order_id, o.order_no, o.host_company_id AS company_id
     FROM production_plan_items ppi
     JOIN orders o ON o.id = ppi.sales_order_id
     LEFT JOIN sales_order_items soi ON soi.id = ppi.sales_order_item_id
     WHERE ppi.plan_id = ?
       AND EXISTS (
         SELECT 1 FROM order_items oi
         WHERE oi.order_id = o.id
           AND (oi.id = ppi.sales_order_item_id OR TRIM(oi.drawing_no) = TRIM(COALESCE(soi.drawing_no, ppi.item_code)))
       )
     ORDER BY ppi.id LIMIT 1`,
    [planId]
  );
  if (current) return { kind: 'ORDER', ...current };

  // 3. Plan header pointing at an older Sales Order without item rows
  const [[legacyHeader]] = await pool.query(
    `SELECT so.id AS order_id, CONCAT('SO-', LPAD(so.id, 4, '0')) AS order_no,
            COALESCE(so.host_company_id, cp.host_company_id) AS company_id, cp.po_number AS customer_po_number
     FROM production_plans pp
     JOIN sales_orders so ON so.id = pp.sales_order_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     WHERE pp.id = ? AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = pp.sales_order_id)`,
    [planId]
  );
  if (legacyHeader) return { kind: 'LEGACY', ...legacyHeader };
  return null;
};

const markDecisionSeen = async (requestId, userId) => {
  await pool.query(
    "UPDATE company_change_requests SET requester_notified_at = NOW() WHERE id = ? AND requested_by = ? AND status <> 'PENDING' AND requester_notified_at IS NULL",
    [requestId, userId]
  );
  return { ok: true };
};

const getPendingCount = async () => {
  const [[row]] = await pool.query("SELECT COUNT(*) AS count FROM company_change_requests WHERE status = 'PENDING'");
  return { count: Number(row.count) || 0 };
};

module.exports = {
  httpError,
  resolveCompanyForNewOrder,
  resolveCompanyForUpdate,
  submitRequest,
  approveRequest,
  rejectRequest,
  listRequests,
  getRequestDetail,
  getOrderHistory,
  getOrderCompanyStatus,
  resolveSource,
  resolvePlanOrder,
  markDecisionSeen,
  getPendingCount
};
