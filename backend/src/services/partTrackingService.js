const pool = require('../config/db');
const drawingService = require('./drawingService');

// Part Tracking (Sales): every Drawing Master drawing and where it is used across Sales.
// A drawing is matched in other tables by drawing number, ignoring spaces and letter case.
const KEY = (col) => `UPPER(TRIM(${col}))`;

const badRequest = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

// Usage of every drawing number per Sales stage (one aggregate per table, joined by drawing key).
// With a date range, only documents dated inside it are counted (5 placeholder pairs, see usageParams).
// A quotation and its revised versions (parent_id chain) count as one quotation; the same PO number uploaded
// more than once for a customer counts as one Customer PO.
const buildUsageSql = (withRange) => {
  const inRange = (col) => (withRange ? ` AND DATE(${col}) BETWEEN ? AND ?` : '');
  return `
  SELECT k, SUM(quotes) AS quotes, SUM(customer_pos) AS customer_pos, SUM(sales_orders) AS sales_orders,
         SUM(projects) AS projects, SUM(invoices) AS invoices, MAX(last_used) AS last_used
  FROM (
    SELECT ${KEY('qr.drawing_no')} AS k, COUNT(DISTINCT COALESCE(qr.parent_id, qr.id)) AS quotes, 0 AS customer_pos, 0 AS sales_orders, 0 AS projects, 0 AS invoices, MAX(qr.created_at) AS last_used
      FROM quotation_requests qr WHERE qr.drawing_no IS NOT NULL AND TRIM(qr.drawing_no) <> ''${inRange('qr.created_at')} GROUP BY k
    UNION ALL
    SELECT ${KEY('u.drawing_no')}, 0, COUNT(DISTINCT u.po_key), 0, 0, 0, MAX(u.used_at)
      FROM (
        SELECT cpi.drawing_no, CONCAT(cp.company_id, '|', UPPER(TRIM(COALESCE(cp.po_number, cp.id)))) AS po_key, COALESCE(cp.po_date, cp.created_at) AS used_at
          FROM customer_po_items cpi JOIN customer_pos cp ON cp.id = cpi.customer_po_id
        UNION ALL
        SELECT sa.drawing_no, CONCAT(cp.company_id, '|', UPPER(TRIM(COALESCE(cp.po_number, cp.id)))), COALESCE(cp.po_date, cp.created_at)
          FROM customer_po_item_subassemblies sa
          JOIN customer_po_items cpi ON cpi.id = sa.po_item_id
          JOIN customer_pos cp ON cp.id = cpi.customer_po_id
      ) u WHERE u.drawing_no IS NOT NULL AND TRIM(u.drawing_no) <> ''${inRange('u.used_at')} GROUP BY 1
    UNION ALL
    SELECT ${KEY('oi.drawing_no')}, 0, 0, COUNT(DISTINCT oi.order_id), 0, 0, MAX(COALESCE(o.order_date, o.created_at))
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE oi.drawing_no IS NOT NULL AND TRIM(oi.drawing_no) <> ''${inRange('COALESCE(o.order_date, o.created_at)')} GROUP BY 1
    UNION ALL
    SELECT ${KEY('soi.drawing_no')}, 0, 0, 0, COUNT(DISTINCT soi.sales_order_id), 0, MAX(so.created_at)
      FROM sales_order_items soi JOIN sales_orders so ON so.id = soi.sales_order_id
      WHERE soi.drawing_no IS NOT NULL AND TRIM(soi.drawing_no) <> ''${inRange('so.created_at')} GROUP BY 1
    UNION ALL
    SELECT ${KEY('sii.drawing_no')}, 0, 0, 0, 0, COUNT(DISTINCT sii.sales_invoice_id), MAX(COALESCE(si.invoice_date, si.created_at))
      FROM sales_invoice_items sii JOIN sales_invoices si ON si.id = sii.sales_invoice_id
      WHERE sii.drawing_no IS NOT NULL AND TRIM(sii.drawing_no) <> '' AND COALESCE(si.status, '') <> 'Cancelled'${inRange('COALESCE(si.invoice_date, si.created_at)')} GROUP BY 1
  ) usage_rows
  GROUP BY k`;
};
const USAGE_SQL = buildUsageSql(false);
// Bind values for buildUsageSql(true): one from/to pair per stage
const usageParams = (from, to) => Array.from({ length: 5 }, () => [from, to]).flat();
const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

const listDrawings = async ({ search = '', client = '', type = '', usage = '', fromDate = '', toDate = '', page = 1, limit = 25 } = {}) => {
  const pageNo = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(limit, 10) || 25));
  const conditions = [];
  const params = [];

  const term = String(search || '').trim();
  if (term) {
    conditions.push('(cd.drawing_no LIKE ? OR cd.description LIKE ? OR cd.client_name LIKE ? OR cd.project_name LIKE ?)');
    const like = `%${term}%`;
    params.push(like, like, like, like);
  }
  if (String(client || '').trim()) {
    conditions.push('cd.client_name = ?');
    params.push(String(client).trim());
  }
  if (String(type || '').trim()) {
    conditions.push('cd.drawing_type = ?');
    params.push(String(type).trim());
  }
  // Date range = Sales activity in the period: usage counts only documents dated inside it, and
  // (unless "Never Used" is chosen) only drawings used in the period are listed
  const from = isIsoDate(fromDate) ? fromDate : '';
  const to = isIsoDate(toDate) ? toDate : '';
  const hasRange = Boolean(from || to);
  const rangeFrom = from || '1900-01-01';
  const rangeTo = to || '9999-12-31';
  if (hasRange && rangeFrom > rangeTo) throw badRequest('From date must be on or before To date');
  const usageSql = hasRange ? buildUsageSql(true) : USAGE_SQL;
  const usageBind = hasRange ? usageParams(rangeFrom, rangeTo) : [];

  const total = '(COALESCE(us.quotes,0) + COALESCE(us.customer_pos,0) + COALESCE(us.sales_orders,0) + COALESCE(us.projects,0) + COALESCE(us.invoices,0))';
  if (usage === 'used' || (hasRange && usage !== 'unused')) conditions.push(`${total} > 0`);
  if (usage === 'unused') conditions.push(`${total} = 0`);

  const [rows] = await pool.query(
    `WITH dm AS (
       SELECT ${KEY('drawing_no')} AS k, MAX(id) AS latest_id, COUNT(*) AS requirement_count
       FROM customer_drawings WHERE drawing_no IS NOT NULL AND TRIM(drawing_no) <> '' GROUP BY k
     ),
     us AS (${usageSql})
     SELECT cd.id, cd.public_id, cd.drawing_no, cd.revision, cd.description, cd.drawing_type, cd.hsn_code,
            cd.client_name, cd.project_name, cd.status, cd.file_path, cd.created_at, dm.requirement_count,
            COALESCE(us.quotes,0) AS quotes, COALESCE(us.customer_pos,0) AS customer_pos,
            COALESCE(us.sales_orders,0) AS sales_orders, COALESCE(us.projects,0) AS projects,
            COALESCE(us.invoices,0) AS invoices, us.last_used,
            COUNT(*) OVER () AS total_rows
     FROM dm
     JOIN customer_drawings cd ON cd.id = dm.latest_id
     LEFT JOIN us ON us.k = dm.k
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY COALESCE(us.last_used, cd.created_at) DESC, cd.drawing_no ASC
     LIMIT ? OFFSET ?`,
    [...usageBind, ...params, pageSize, (pageNo - 1) * pageSize]
  );

  const [[stats]] = await pool.query(
    `WITH dm AS (SELECT ${KEY('drawing_no')} AS k FROM customer_drawings WHERE drawing_no IS NOT NULL AND TRIM(drawing_no) <> '' GROUP BY k),
          us AS (${usageSql})
     SELECT COUNT(*) AS total,
            SUM(CASE WHEN us.k IS NOT NULL THEN 1 ELSE 0 END) AS used,
            SUM(CASE WHEN COALESCE(us.invoices,0) > 0 THEN 1 ELSE 0 END) AS invoiced
     FROM dm LEFT JOIN us ON us.k = dm.k`,
    usageBind
  );
  const [clients] = await pool.query(
    "SELECT DISTINCT client_name FROM customer_drawings WHERE client_name IS NOT NULL AND TRIM(client_name) <> '' ORDER BY client_name"
  );
  const [types] = await pool.query(
    "SELECT DISTINCT drawing_type FROM customer_drawings WHERE drawing_type IS NOT NULL AND TRIM(drawing_type) <> '' ORDER BY drawing_type"
  );

  const totalRows = rows.length ? Number(rows[0].total_rows) : 0;
  return {
    data: rows.map(({ total_rows, ...r }) => ({
      ...r,
      requirement_count: Number(r.requirement_count) || 0,
      quotes: Number(r.quotes) || 0,
      customer_pos: Number(r.customer_pos) || 0,
      sales_orders: Number(r.sales_orders) || 0,
      projects: Number(r.projects) || 0,
      invoices: Number(r.invoices) || 0
    })),
    page: pageNo,
    limit: pageSize,
    total: totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
    stats: {
      total: Number(stats.total) || 0,
      used: Number(stats.used) || 0,
      unused: (Number(stats.total) || 0) - (Number(stats.used) || 0),
      invoiced: Number(stats.invoiced) || 0
    },
    filters: {
      clients: clients.map(c => c.client_name),
      types: types.map(t => t.drawing_type)
    }
  };
};

// Every Sales record that uses one drawing number, in workflow order.
// Note: orders.quotation_id holds the Customer PO (customer_pos.id) the Sales Order was created from.
const getWhereUsed = async (drawingNo) => {
  const key = String(drawingNo || '').trim().toUpperCase();
  if (!key) throw badRequest('Drawing number is required');

  const [requirements] = await pool.query(
    `SELECT id, public_id, drawing_no, revision, description, drawing_type, hsn_code, qty, client_name, project_name,
            status, file_path, delivery_date, created_at
     FROM customer_drawings WHERE ${KEY('drawing_no')} = ? ORDER BY id DESC`,
    [key]
  );
  if (!requirements.length) throw badRequest(`Drawing ${drawingNo} is not in the Drawing Master`, 404);

  const [quotationRows] = await pool.query(
    `SELECT qr.id, qr.parent_id, qr.version, qr.status, qr.item_qty AS quantity, qr.total_amount, qr.project_name, qr.created_at AS doc_date,
            c.company_name AS customer
     FROM quotation_requests qr LEFT JOIN companies c ON c.id = qr.company_id
     WHERE ${KEY('qr.drawing_no')} = ? ORDER BY qr.created_at DESC, qr.id DESC`,
    [key]
  );
  // A quotation and its revisions form one chain (root = parent_id or own id). Only the latest version that was
  // not rejected counts; earlier / rejected versions stay listed but are marked superseded.
  const chainOf = (q) => q.parent_id || q.id;
  const currentByChain = {};
  quotationRows.forEach(q => {
    const chain = chainOf(q);
    const best = currentByChain[chain];
    const rejected = String(q.status || '').toUpperCase() === 'REJECTED';
    const bestRejected = best && String(best.status || '').toUpperCase() === 'REJECTED';
    if (!best || (bestRejected && !rejected) || (bestRejected === rejected && Number(q.version || 0) > Number(best.version || 0))) {
      currentByChain[chain] = q;
    }
  });
  const quotations = quotationRows.map(q => ({
    ...q,
    chain_id: chainOf(q),
    is_current: currentByChain[chainOf(q)] === q && String(q.status || '').toUpperCase() !== 'REJECTED'
  }));

  const [customerPoRows] = await pool.query(
    `SELECT cpi.id, cp.id AS customer_po_id, cp.company_id, cp.po_number AS doc_no, COALESCE(cp.po_date, cp.created_at) AS doc_date,
            cp.created_at AS uploaded_at, c.company_name AS customer, cp.project_name, cpi.quantity, cpi.unit, cpi.rate,
            cpi.basic_amount AS amount, cpi.delivery_date, COALESCE(cpi.status, cp.status) AS status, 'Item' AS line_type,
            NULL AS parent_drawing_no, NULL AS per_parent_qty, NULL AS parent_qty,
            (SELECT o.order_no FROM orders o WHERE o.quotation_id = cp.id ORDER BY o.id DESC LIMIT 1) AS linked_order_no
     FROM customer_po_items cpi
     JOIN customer_pos cp ON cp.id = cpi.customer_po_id
     LEFT JOIN companies c ON c.id = cp.company_id
     WHERE ${KEY('cpi.drawing_no')} = ?
     UNION ALL
     -- Sub-assembly lines: quantity is per unit of the parent drawing, so the total needed = per-unit qty × parent qty
     SELECT sa.id, cp.id, cp.company_id, cp.po_number, COALESCE(cp.po_date, cp.created_at), cp.created_at, c.company_name,
            cp.project_name, (sa.quantity * COALESCE(NULLIF(cpi.quantity, 0), 1)), sa.unit, sa.rate,
            (sa.quantity * COALESCE(NULLIF(cpi.quantity, 0), 1) * sa.rate), sa.delivery_date, cp.status, 'Sub-assembly',
            cpi.drawing_no, sa.quantity, cpi.quantity,
            (SELECT o.order_no FROM orders o WHERE o.quotation_id = cp.id ORDER BY o.id DESC LIMIT 1)
     FROM customer_po_item_subassemblies sa
     JOIN customer_po_items cpi ON cpi.id = sa.po_item_id
     JOIN customer_pos cp ON cp.id = cpi.customer_po_id
     LEFT JOIN companies c ON c.id = cp.company_id
     WHERE ${KEY('sa.drawing_no')} = ?
     ORDER BY doc_date DESC`,
    [key, key]
  );
  // The same PO number uploaded more than once for one customer is one PO. Keep the upload a Sales Order was
  // created from, otherwise the latest upload; the other uploads are reported, not counted.
  const poGroups = {};
  customerPoRows.forEach(r => {
    const groupKey = `${r.company_id}|${String(r.doc_no || r.customer_po_id).trim().toUpperCase()}`;
    (poGroups[groupKey] = poGroups[groupKey] || []).push(r);
  });
  const customerPos = [];
  Object.values(poGroups).forEach(group => {
    const uploads = [...new Set(group.map(r => r.customer_po_id))];
    const withOrder = group.filter(r => r.linked_order_no).map(r => r.customer_po_id);
    const keepId = withOrder.length ? Math.max(...withOrder) : Math.max(...uploads);
    group.filter(r => r.customer_po_id === keepId).forEach(r => customerPos.push({ ...r, duplicate_uploads: uploads.length - 1 }));
  });
  customerPos.sort((a, b) => String(b.doc_date).localeCompare(String(a.doc_date)));
  const duplicatePoUploads = Object.values(poGroups).reduce((s, g) => s + new Set(g.map(r => r.customer_po_id)).size - 1, 0);

  const [salesOrders] = await pool.query(
    `SELECT oi.id, o.id AS order_id, o.order_no AS doc_no, COALESCE(o.order_date, o.created_at) AS doc_date,
            c.company_name AS customer, o.project_name, oi.quantity, oi.rate, oi.amount, oi.delivery_date, o.status,
            cp.po_number AS against_po_no
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN companies c ON c.id = o.client_id
     LEFT JOIN customer_pos cp ON cp.id = o.quotation_id
     WHERE ${KEY('oi.drawing_no')} = ? ORDER BY doc_date DESC, oi.id DESC`,
    [key]
  );

  const [projects] = await pool.query(
    `SELECT soi.id, so.id AS sales_order_id, COALESCE(so.so_number, CONCAT('SO-', so.id)) AS doc_no, so.created_at AS doc_date,
            c.company_name AS customer, so.project_name, soi.quantity, soi.unit, soi.rate,
            COALESCE(soi.status, so.status) AS item_status, so.status, so.current_department
     FROM sales_order_items soi
     JOIN sales_orders so ON so.id = soi.sales_order_id
     LEFT JOIN companies c ON c.id = so.company_id
     WHERE ${KEY('soi.drawing_no')} = ? ORDER BY so.created_at DESC, soi.id DESC`,
    [key]
  );

  const [invoices] = await pool.query(
    `SELECT sii.id, si.id AS sales_invoice_id, si.invoice_no AS doc_no, COALESCE(si.invoice_date, si.created_at) AS doc_date,
            c.company_name AS customer, si.project_name, si.customer_po_no, sii.invoice_qty AS quantity, sii.uom AS unit,
            sii.unit_rate AS rate, sii.amount, si.status
     FROM sales_invoice_items sii
     JOIN sales_invoices si ON si.id = sii.sales_invoice_id
     LEFT JOIN companies c ON c.id = si.client_id
     WHERE ${KEY('sii.drawing_no')} = ? ORDER BY doc_date DESC, sii.id DESC`,
    [key]
  );

  const [creditNotes] = await pool.query(
    `SELECT cni.id, cn.id AS credit_note_id, cn.voucher_no AS doc_no, cn.voucher_date AS doc_date, c.company_name AS customer,
            cn.reference_invoice_no, cni.quantity, cni.unit, cni.rate, cni.total_amount AS amount, cn.status
     FROM credit_note_items cni
     JOIN credit_notes cn ON cn.id = cni.credit_note_id
     LEFT JOIN companies c ON c.id = cn.customer_id
     WHERE ${KEY('cni.drawing_no')} = ? ORDER BY doc_date DESC, cni.id DESC`,
    [key]
  );

  const sum = (rows, pick = r => r.quantity) => rows.reduce((s, r) => s + (Number(pick(r)) || 0), 0);
  const round = (n) => Math.round(n * 1000) / 1000;
  const poQty = sum(customerPos.filter(r => r.line_type === 'Item'));
  const invoicedQty = sum(invoices.filter(r => String(r.status || '') !== 'Cancelled'));
  const returnedQty = sum(creditNotes.filter(r => String(r.status || '').toUpperCase() === 'POSTED'));

  const latest = requirements[0];
  return {
    drawing: {
      id: latest.id,
      public_id: latest.public_id,
      drawing_no: latest.drawing_no,
      revision: latest.revision,
      description: latest.description,
      drawing_type: latest.drawing_type,
      hsn_code: latest.hsn_code,
      client_name: latest.client_name,
      status: latest.status,
      file_path: latest.file_path
    },
    summary: {
      // Document counts: each unique document once, even if the drawing appears in it several times;
      // Customer POs include sub-assembly usage and equal the POs listed in the Customer PO section
      quoteCount: new Set(quotations.map(q => q.chain_id)).size,
      poCount: new Set(customerPos.map(r => r.customer_po_id)).size,
      orderCount: new Set(salesOrders.map(r => r.order_id)).size,
      projectCount: new Set(projects.map(r => r.sales_order_id)).size,
      invoiceCount: new Set(invoices.filter(r => String(r.status || '') !== 'Cancelled').map(r => r.sales_invoice_id)).size,
      quotedQty: round(sum(quotations.filter(q => q.is_current))),
      duplicatePoUploads,
      // Needed inside other drawings (sub-assembly lines); kept apart from poQty, units can differ
      subAssemblyQty: round(sum(customerPos.filter(r => r.line_type === 'Sub-assembly'))),
      subAssemblyUnits: [...new Set(customerPos.filter(r => r.line_type === 'Sub-assembly').map(r => r.unit).filter(Boolean))].join('/'),
      poQty: round(poQty),
      orderQty: round(sum(salesOrders)),
      invoicedQty: round(invoicedQty),
      returnedQty: round(returnedQty),
      pendingToInvoice: round(Math.max(0, poQty - invoicedQty))
    },
    stages: {
      requirements,
      quotations,
      customerPos,
      salesOrders,
      projects,
      invoices,
      creditNotes
    }
  };
};

// Safe fields only; saved through the Drawing Master update so its existing rules still apply
const updateDrawingDetails = async (id, body = {}) => {
  const data = {};
  if (body.description !== undefined) data.description = String(body.description || '').trim();
  if (body.revision !== undefined) data.revisionNo = String(body.revision || '').trim();
  if (body.drawingType !== undefined) data.drawing_type = String(body.drawingType || '').trim() || 'Part';
  if (body.hsnCode !== undefined) {
    const hsn = String(body.hsnCode || '').replace(/\s/g, '');
    if (hsn && !/^\d{4,8}$/.test(hsn)) throw badRequest('HSN Code must be 4 to 8 digits');
    data.hsnCode = hsn;
  }
  if (!Object.keys(data).length) throw badRequest('Nothing to update');
  const [rows] = await pool.query('SELECT id FROM customer_drawings WHERE id = ?', [id]);
  if (!rows.length) throw badRequest('Drawing not found', 404);
  await drawingService.updateDrawing(id, data);
  const [updated] = await pool.query(
    'SELECT id, drawing_no, revision, description, drawing_type, hsn_code FROM customer_drawings WHERE id = ?',
    [id]
  );
  return updated[0];
};

module.exports = {
  listDrawings,
  getWhereUsed,
  updateDrawingDetails
};
