// Sales Order issuing company → change only through Admin approval.
//
// Two Sales Order tables exist:
//   ORDER        → `orders` (current Sales Order module). Linked to a Customer PO when source_type = 'DIRECT'
//                  and quotation_id = customer_pos.id. Invoices: sales_invoices.order_id.
//   SALES_ORDER  → `sales_orders` (previous module, still referenced by production plans / material requests).
//                  Linked to a Customer PO through customer_po_id. Invoices: sales_invoices.sales_order_id.
//
//   - A Customer PO based Sales Order uses the Customer PO's company (customer_pos.host_company_id).
//   - A change request needs a reason; one PENDING request per Sales Order; refused when an invoice exists.
//   - Admin approves → the Sales Order's host_company_id is updated; audit history keeps both company snapshots.
//   - Admin rejects (remarks required) → company unchanged; a new request can be submitted.
// The Customer PO company is never modified. Invoices are never modified.
const pool = require('../config/db');

const httpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  return error;
};

const SOURCES = ['ORDER', 'SALES_ORDER'];
const normSource = (s) => (String(s || 'ORDER').toUpperCase() === 'SALES_ORDER' ? 'SALES_ORDER' : 'ORDER');
const legacyOrderNo = (id) => `SO-${String(id).padStart(4, '0')}`;

// Linked Customer PO for an `orders` row (same rule the Sales Order list uses for its client / PO number)
const getLinkedCustomerPo = async (connection, order) => {
  if (!order || order.source_type !== 'DIRECT' || !order.quotation_id) return null;
  const [rows] = await connection.query(
    'SELECT id, po_number, host_company_id FROM customer_pos WHERE id = ?',
    [order.quotation_id]
  );
  return rows[0] || null;
};

const getCustomerPoById = async (connection, cpoId) => {
  if (!cpoId) return null;
  const [rows] = await connection.query('SELECT id, po_number, host_company_id FROM customer_pos WHERE id = ?', [cpoId]);
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

// Normalised Sales Order: { source, id, order_no, host_company_id, project_name, cpo }
const loadOrder = async (connection, source, orderId, forUpdate = false) => {
  const lock = forUpdate ? ' FOR UPDATE' : '';
  if (normSource(source) === 'SALES_ORDER') {
    const [rows] = await connection.query(`SELECT id, customer_po_id, host_company_id, project_name FROM sales_orders WHERE id = ?${lock}`, [orderId]);
    if (!rows.length) throw httpError('Sales Order not found', 404);
    const so = rows[0];
    return {
      source: 'SALES_ORDER', id: so.id, order_no: legacyOrderNo(so.id), host_company_id: so.host_company_id,
      project_name: so.project_name, cpo: await getCustomerPoById(connection, so.customer_po_id)
    };
  }
  const [rows] = await connection.query(`SELECT * FROM orders WHERE id = ?${lock}`, [orderId]);
  if (!rows.length) throw httpError('Sales Order not found', 404);
  const o = rows[0];
  return {
    source: 'ORDER', id: o.id, order_no: o.order_no, host_company_id: o.host_company_id,
    project_name: o.project_name, cpo: await getLinkedCustomerPo(connection, o)
  };
};

// Invoices already raised against this Sales Order (any invoice blocks a silent company change)
const getInvoices = async (connection, source, orderId) => {
  const col = normSource(source) === 'SALES_ORDER' ? 'sales_order_id' : 'order_id';
  const [rows] = await connection.query(
    `SELECT id, invoice_no, status, host_company_id FROM sales_invoices WHERE ${col} = ? ORDER BY id`,
    [orderId]
  );
  return rows;
};

// ---- Guards used by orderService (create / update of `orders`) ----

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

// Guard for the previous Sales Order module (`sales_orders`): a Customer PO based order keeps its approved company
const resolveLegacyCompanyForUpdate = async (connection, salesOrderId, requestedHostCompanyId) => {
  const [rows] = await connection.query('SELECT id, customer_po_id, host_company_id FROM sales_orders WHERE id = ?', [salesOrderId]);
  if (!rows.length) return requestedHostCompanyId || null;
  const so = rows[0];
  const cpo = await getCustomerPoById(connection, so.customer_po_id);
  if (!cpo) return requestedHostCompanyId || null;
  const locked = so.host_company_id || cpo.host_company_id || null;
  const requested = requestedHostCompanyId ? Number(requestedHostCompanyId) : null;
  if (requested && locked && requested !== Number(locked)) {
    throw httpError(
      `The issuing company of this Sales Order is locked to Customer PO ${cpo.po_number}. Use "Request Company Change" — the change needs Admin approval.`,
      403
    );
  }
  // Nothing sent → keep what is stored (do not overwrite with the Customer PO company)
  return requested ? locked : (so.host_company_id || null);
};

// ---- Submit (Sales / Procurement / Inventory / QC) ----

const submitRequest = async ({ orderId, orderSource, requestedCompanyId, reason }, userId) => {
  if (!reason || !String(reason).trim()) throw httpError('Reason for the company change is required');
  if (!requestedCompanyId) throw httpError('Select the requested company');
  const source = normSource(orderSource);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const order = await loadOrder(connection, source, orderId, true);
    if (!order.cpo) throw httpError('Company change approval applies only to Sales Orders created from a Customer PO. This order can be edited directly.');

    const invoices = await getInvoices(connection, source, order.id);
    if (invoices.length) {
      throw httpError(`Invoice ${invoices.map(i => i.invoice_no || `#${i.id}`).join(', ')} already exists for this Sales Order. The issuing company cannot be changed here; use a controlled invoice correction.`);
    }

    const [pending] = await connection.query(
      "SELECT id FROM company_change_requests WHERE order_source = ? AND order_id = ? AND status = 'PENDING' FOR UPDATE",
      [source, order.id]
    );
    if (pending.length) throw httpError('A company change request for this Sales Order is already pending Admin approval.');

    const requested = await getCompany(connection, requestedCompanyId);
    if (!requested) throw httpError('Requested company not found in Company Master', 404);
    const currentId = order.host_company_id || order.cpo.host_company_id || null;
    if (currentId && Number(currentId) === Number(requested.id)) throw httpError('The Sales Order already uses this company.');
    const current = await getCompany(connection, currentId);

    const [res] = await connection.execute(
      `INSERT INTO company_change_requests
        (order_source, order_id, order_no, customer_po_id, customer_po_number, current_company_id, current_company_name,
         requested_company_id, requested_company_name, reason, status, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [source, order.id, order.order_no || null, order.cpo.id, order.cpo.po_number || null, currentId, current ? current.company_name : null,
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
    const source = normSource(req.order_source);

    const order = await loadOrder(connection, source, req.order_id, true);
    const invoices = await getInvoices(connection, source, order.id);
    if (invoices.length) {
      throw httpError(`Invoice ${invoices.map(i => i.invoice_no || `#${i.id}`).join(', ')} was created for this Sales Order after the request. Reject this request; the invoice needs a controlled correction.`);
    }

    const newCompany = await getCompany(connection, req.requested_company_id);
    if (!newCompany) throw httpError('Requested company no longer exists in Company Master', 404);
    const oldCompanyId = order.host_company_id || (order.cpo && order.cpo.host_company_id) || null;
    const oldCompany = await getCompany(connection, oldCompanyId);

    if (source === 'SALES_ORDER') {
      await connection.execute('UPDATE sales_orders SET host_company_id = ? WHERE id = ?', [newCompany.id, order.id]);
    } else {
      await connection.execute('UPDATE orders SET host_company_id = ?, updated_at = NOW() WHERE id = ?', [newCompany.id, order.id]);
    }
    await connection.execute(
      `UPDATE company_change_requests SET status = 'APPROVED', decided_by = ?, decided_at = NOW(), decision_remarks = ?
       WHERE id = ? AND status = 'PENDING'`,
      [adminId || null, remarks || null, req.id]
    );
    await connection.execute(
      `INSERT INTO company_change_history
        (request_id, order_source, order_id, order_no, customer_po_id, old_company_id, new_company_id, old_company_snapshot, new_company_snapshot, changed_by, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.id, source, order.id, order.order_no || null, req.customer_po_id, oldCompanyId, newCompany.id,
        oldCompany ? JSON.stringify(oldCompany) : null, JSON.stringify(newCompany), adminId || null, remarks || req.reason]
    );

    await connection.commit();
    return { id: req.id, status: 'APPROVED', order_source: source, order_id: order.id, host_company_id: newCompany.id, company_name: newCompany.company_name };
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
         COALESCE(o.host_company_id, so.host_company_id) AS order_current_company_id,
         COALESCE(o.project_name, so.project_name) AS project_name, o.grand_total,
         (SELECT COUNT(*) FROM sales_invoices si
           WHERE (r.order_source = 'SALES_ORDER' AND si.sales_order_id = r.order_id)
              OR (r.order_source <> 'SALES_ORDER' AND si.order_id = r.order_id)) AS invoice_count
  FROM company_change_requests r
  LEFT JOIN users ur ON ur.id = r.requested_by
  LEFT JOIN users ud ON ud.id = r.decided_by
  LEFT JOIN company_master cc ON cc.id = r.current_company_id
  LEFT JOIN company_master rc ON rc.id = r.requested_company_id
  LEFT JOIN orders o ON o.id = r.order_id AND r.order_source <> 'SALES_ORDER'
  LEFT JOIN sales_orders so ON so.id = r.order_id AND r.order_source = 'SALES_ORDER'`;

const listRequests = async ({ status = 'PENDING', search = '' } = {}) => {
  const params = [];
  let where = '1=1';
  if (['PENDING', 'APPROVED', 'REJECTED'].includes(status)) { where += ' AND r.status = ?'; params.push(status); }
  if (search && String(search).trim()) {
    const like = `%${String(search).trim()}%`;
    where += ' AND (r.order_no LIKE ? OR r.customer_po_number LIKE ? OR r.current_company_name LIKE ? OR r.requested_company_name LIKE ? OR COALESCE(o.project_name, so.project_name) LIKE ?)';
    params.push(like, like, like, like, like);
  }
  const [rows] = await pool.query(`${REQUEST_SELECT} WHERE ${where} ORDER BY r.requested_at DESC, r.id DESC LIMIT 500`, params);
  return rows;
};

const getOrderHistory = async (orderId, orderSource = 'ORDER') => {
  const [rows] = await pool.query(
    `SELECT h.id, h.request_id, h.order_source, h.order_id, h.order_no, h.old_company_id, h.new_company_id, h.changed_at, h.remarks,
            JSON_UNQUOTE(JSON_EXTRACT(h.old_company_snapshot, '$.company_name')) AS old_company_name,
            JSON_UNQUOTE(JSON_EXTRACT(h.old_company_snapshot, '$.gstin')) AS old_gstin,
            JSON_UNQUOTE(JSON_EXTRACT(h.new_company_snapshot, '$.company_name')) AS new_company_name,
            JSON_UNQUOTE(JSON_EXTRACT(h.new_company_snapshot, '$.gstin')) AS new_gstin,
            u.username AS changed_by_name
     FROM company_change_history h LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.order_source = ? AND h.order_id = ? ORDER BY h.changed_at ASC, h.id ASC`,
    [normSource(orderSource), orderId]
  );
  return rows;
};

const getRequestDetail = async (requestId) => {
  const [rows] = await pool.query(`${REQUEST_SELECT} WHERE r.id = ?`, [requestId]);
  if (!rows.length) throw httpError('Company change request not found', 404);
  const r = rows[0];
  const [requests] = await pool.query(
    `SELECT r.id, r.status, r.current_company_name, r.requested_company_name, r.reason, r.requested_at, r.decided_at, r.decision_remarks,
            ur.username AS requested_by_name, ud.username AS decided_by_name
     FROM company_change_requests r LEFT JOIN users ur ON ur.id = r.requested_by LEFT JOIN users ud ON ud.id = r.decided_by
     WHERE r.order_source = ? AND r.order_id = ? ORDER BY r.id ASC`,
    [normSource(r.order_source), r.order_id]
  );
  return { ...r, requests, history: await getOrderHistory(r.order_id, r.order_source) };
};

// Lock status of a Sales Order: is the company locked, by which Customer PO, and what is the latest request?
const getOrderCompanyStatus = async (orderId, userId = null, orderSource = 'ORDER') => {
  const source = normSource(orderSource);
  const order = await loadOrder(pool, source, orderId, false);
  const cpo = order.cpo;
  const company = await getCompany(pool, order.host_company_id || (cpo && cpo.host_company_id));
  const cpoCompany = cpo ? await getCompany(pool, cpo.host_company_id) : null;
  const invoices = await getInvoices(pool, source, order.id);
  const [requests] = await pool.query(
    `SELECT r.*, ur.username AS requested_by_name, ud.username AS decided_by_name
     FROM company_change_requests r LEFT JOIN users ur ON ur.id = r.requested_by LEFT JOIN users ud ON ud.id = r.decided_by
     WHERE r.order_source = ? AND r.order_id = ? ORDER BY r.id DESC`,
    [source, order.id]
  );
  const latest = requests[0] || null;
  // One-time notice for the requester once Admin has decided
  const unseenDecision = latest && latest.status !== 'PENDING' && !latest.requester_notified_at && userId && Number(latest.requested_by) === Number(userId)
    ? latest : null;
  return {
    order_source: source,
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
    history: await getOrderHistory(order.id, source)
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

  const source = link.kind === 'LEGACY' ? 'SALES_ORDER' : 'ORDER';
  const company = await getCompany(pool, link.company_id);
  const status = await getOrderCompanyStatus(link.order_id, userId, source);
  return {
    found: true,
    kind: link.kind,
    order_source: source,
    mr_id: mrRow.id,
    mr_number: mrRow.mr_number,
    po_id: po,
    order_id: link.order_id,
    order_no: link.order_no,
    customer_po_number: link.customer_po_number || (status.customer_po ? status.customer_po.po_number : null),
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

// Company (Company Master id) of every Material Request / quotation / PO / receipt / GRN, for list filters.
// Same rule as resolvePlanOrder (MR → production plan → Sales Order company); documents without a traceable
// Sales Order fall back to their own stored company.
const MR_COMPANY_SQL = `
  CASE
    WHEN EXISTS (SELECT 1 FROM production_plan_items ppi
                 JOIN sales_order_items soi ON soi.id = ppi.sales_order_item_id AND soi.sales_order_id = ppi.sales_order_id
                 WHERE ppi.plan_id = mr.plan_id)
      THEN (SELECT COALESCE(so.host_company_id, cp.host_company_id)
            FROM production_plan_items ppi
            JOIN sales_order_items soi ON soi.id = ppi.sales_order_item_id AND soi.sales_order_id = ppi.sales_order_id
            JOIN sales_orders so ON so.id = soi.sales_order_id
            LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
            WHERE ppi.plan_id = mr.plan_id ORDER BY ppi.id LIMIT 1)
    ELSE COALESCE(
      (SELECT o.host_company_id
       FROM production_plan_items ppi
       JOIN orders o ON o.id = ppi.sales_order_id
       LEFT JOIN sales_order_items soi ON soi.id = ppi.sales_order_item_id
       WHERE ppi.plan_id = mr.plan_id
         AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
                     AND (oi.id = ppi.sales_order_item_id OR TRIM(oi.drawing_no) = TRIM(COALESCE(soi.drawing_no, ppi.item_code))))
       ORDER BY ppi.id LIMIT 1),
      (SELECT COALESCE(so.host_company_id, cp.host_company_id)
       FROM production_plans pp
       JOIN sales_orders so ON so.id = pp.sales_order_id
       LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
       WHERE pp.id = mr.plan_id AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = pp.sales_order_id))
    )
  END`;

const getCompanyMap = async () => {
  const toMap = (rows) => rows.reduce((acc, r) => { if (r.company_id) acc[r.id] = r.company_id; return acc; }, {});

  const [mrRows] = await pool.query(`SELECT mr.id, ${MR_COMPANY_SQL} AS company_id FROM material_requests mr`);
  const mr = toMap(mrRows);

  const [qRows] = await pool.query('SELECT id, mr_id, host_company_id FROM quotations');
  const quotation = qRows.reduce((acc, q) => {
    const c = (q.mr_id && mr[q.mr_id]) || q.host_company_id;
    if (c) acc[q.id] = c;
    return acc;
  }, {});

  const [poRows] = await pool.query(
    `SELECT po.id, po.po_number, COALESCE(po.mr_id, q.mr_id) AS mr_id, po.host_company_id, q.host_company_id AS quote_company_id
     FROM purchase_orders po LEFT JOIN quotations q ON q.id = po.quotation_id`
  );
  const po = {};
  const poByNumber = {};
  poRows.forEach(p => {
    const c = (p.mr_id && mr[p.mr_id]) || p.host_company_id || p.quote_company_id;
    if (c) { po[p.id] = c; if (p.po_number) poByNumber[p.po_number] = c; }
  });

  const [rcRows] = await pool.query('SELECT id, po_id, host_company_id FROM po_receipts');
  const receipt = rcRows.reduce((acc, r) => {
    const c = (r.po_id && po[r.po_id]) || r.host_company_id;
    if (c) acc[r.id] = c;
    return acc;
  }, {});

  const [gRows] = await pool.query('SELECT id, po_number, po_receipt_id FROM grns');
  const grn = gRows.reduce((acc, g) => {
    const c = (g.po_number && poByNumber[g.po_number]) || (g.po_receipt_id && receipt[g.po_receipt_id]);
    if (c) acc[g.id] = c;
    return acc;
  }, {});

  return { mr, quotation, po, receipt, grn };
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
  SOURCES,
  httpError,
  resolveCompanyForNewOrder,
  resolveCompanyForUpdate,
  resolveLegacyCompanyForUpdate,
  submitRequest,
  approveRequest,
  rejectRequest,
  listRequests,
  getRequestDetail,
  getOrderHistory,
  getOrderCompanyStatus,
  resolveSource,
  resolvePlanOrder,
  getCompanyMap,
  markDecisionSeen,
  getPendingCount
};
