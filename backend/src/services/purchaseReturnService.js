// Purchase Returns (Procurement): QC-rejected GRN material sent back to the supplier.
//
//   Incoming QC "Reject" (or any rejected qty/weight on a QC line) → Pending Returns (automatic)
//   → Purchase Return PR-YYYY-NNNN (DRAFT) → Return Challan → DISPATCHED → (Phase 3) Replacement / Debit Note → CLOSED
//
// Rules: one supplier + one PO per return; returned qty/weight never exceed rejected − already returned
// (cancelled returns don't count). Rejected material never entered stock, so nothing is posted to stock here.
// GRN, QC, PO and stock records are only read.
const pool = require('../config/db');
const { formatDimensions } = require('../utils/formatDimensions');

const RETURN_TYPES = ['REPLACEMENT', 'DEBIT_NOTE'];
const EPS = 0.0005;
const round3 = (n) => Math.round((parseFloat(n) || 0) * 1000) / 1000;
const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

const httpError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const isWeightUnit = (unit) => /^(kg|kgs|kilogram|kilograms)$/i.test(String(unit || '').trim());

// Size shown on the return: QC-measured size, else received size, else ordered size
const sizeTextOf = (r) => {
  const pick = (prefix) => ({
    length: r[`${prefix}length`], width: r[`${prefix}width`], thickness: r[`${prefix}thickness`],
    diameter: r[`${prefix}diameter`], outer_diameter: r[`${prefix}outer_diameter`]
  });
  const has = (d) => Object.values(d).some(v => v !== null && v !== undefined && parseFloat(v) > 0);
  const dims = has(pick('qc_')) ? pick('qc_') : (has(pick('received_')) ? pick('received_') : pick(''));
  return formatDimensions({ ...dims, shape_type: r.shape_type, material_name: r.material_name, item_code: r.item_code }) || '';
};

// Rejected QC lines with what is still to be returned
const PENDING_SQL = `
  SELECT qci.id AS qc_item_id, qci.qc_inspection_id, qc.grn_id, qci.grn_item_id, gi.po_item_id,
         COALESCE(NULLIF(qci.item_code, ''), poi.item_code) AS item_code,
         COALESCE(poi.material_name, poi.description, qci.item_code) AS material_name,
         poi.description, poi.unit_rate, COALESCE(poi.unit, poi.uom) AS unit,
         qci.rejected_qty, qci.rejected_weight, qci.qc_decision, qci.remarks AS qc_remarks,
         qc.inspection_date, qc.status AS qc_status,
         g.po_number, g.grn_date,
         po.id AS po_id, po.vendor_id, po.created_at AS po_date, v.vendor_name, v.vendor_code,
         COALESCE(gi.shape_type, poi.shape_type) AS shape_type,
         CASE WHEN gi.length > 0 THEN gi.length ELSE poi.length END AS length,
         CASE WHEN gi.width > 0 THEN gi.width ELSE poi.width END AS width,
         CASE WHEN gi.thickness > 0 THEN gi.thickness ELSE poi.thickness END AS thickness,
         CASE WHEN gi.diameter > 0 THEN gi.diameter ELSE poi.diameter END AS diameter,
         CASE WHEN gi.outer_diameter > 0 THEN gi.outer_diameter ELSE poi.outer_diameter END AS outer_diameter,
         gi.received_length, gi.received_width, gi.received_thickness, gi.received_diameter, gi.received_outer_diameter,
         qci.qc_length, qci.qc_width, qci.qc_thickness, qci.qc_diameter, qci.qc_outer_diameter,
         COALESCE(r.ret_qty, 0) AS returned_qty, COALESCE(r.ret_wt, 0) AS returned_weight
  FROM qc_inspection_items qci
  JOIN qc_inspections qc ON qc.id = qci.qc_inspection_id
  JOIN grn_items gi ON gi.id = qci.grn_item_id
  JOIN grns g ON g.id = qc.grn_id
  LEFT JOIN purchase_orders po ON po.id = (SELECT p.id FROM purchase_orders p WHERE p.po_number = g.po_number ORDER BY p.id DESC LIMIT 1)
  LEFT JOIN purchase_order_items poi ON poi.id = gi.po_item_id
  LEFT JOIN vendors v ON v.id = po.vendor_id
  LEFT JOIN (
    SELECT pri.qc_inspection_item_id, SUM(pri.quantity) AS ret_qty, SUM(pri.weight) AS ret_wt
    FROM purchase_return_items pri
    JOIN purchase_returns pr ON pr.id = pri.purchase_return_id AND pr.status <> 'CANCELLED'
    GROUP BY pri.qc_inspection_item_id
  ) r ON r.qc_inspection_item_id = qci.id
  WHERE (qci.rejected_qty > 0 OR qci.rejected_weight > 0)`;

const shapePending = (r) => {
  const rejQty = round3(r.rejected_qty);
  const rejWt = round3(r.rejected_weight);
  const pendingQty = Math.max(0, round3(rejQty - (parseFloat(r.returned_qty) || 0)));
  const pendingWt = Math.max(0, round3(rejWt - (parseFloat(r.returned_weight) || 0)));
  const rate = parseFloat(r.unit_rate) || 0;
  const byWeight = isWeightUnit(r.unit) && pendingWt > 0;
  return {
    qc_item_id: r.qc_item_id,
    qc_inspection_id: r.qc_inspection_id,
    grn_id: r.grn_id,
    grn_no: `GRN-${String(r.grn_id).padStart(4, '0')}`,
    grn_date: r.grn_date,
    grn_item_id: r.grn_item_id,
    po_id: r.po_id,
    po_number: r.po_number,
    po_item_id: r.po_item_id,
    vendor_id: r.vendor_id,
    vendor_name: r.vendor_name,
    vendor_code: r.vendor_code,
    item_code: r.item_code,
    material_name: r.material_name,
    description: r.description,
    size_text: sizeTextOf(r),
    unit: r.unit || (byWeight ? 'KG' : 'NOS'),
    rate,
    qc_decision: r.qc_decision || 'REJECT',
    qc_remarks: r.qc_remarks || '',
    inspection_date: r.inspection_date,
    rejected_qty: rejQty,
    rejected_weight: rejWt,
    returned_qty: round3(r.returned_qty),
    returned_weight: round3(r.returned_weight),
    pending_qty: pendingQty,
    pending_weight: pendingWt,
    pending_value: round2(rate * (byWeight ? pendingWt : pendingQty))
  };
};

const getPendingReturns = async ({ vendorId, poId } = {}) => {
  let sql = PENDING_SQL;
  const params = [];
  if (vendorId) { sql += ' AND po.vendor_id = ?'; params.push(vendorId); }
  if (poId) { sql += ' AND po.id = ?'; params.push(poId); }
  sql += ' ORDER BY qc.inspection_date DESC, qci.id DESC';
  const [rows] = await pool.query(sql, params);
  return rows.map(shapePending).filter(r => r.pending_qty > EPS || r.pending_weight > EPS);
};

const nextReturnNo = async (connection) => {
  const year = new Date().getFullYear();
  const [rows] = await connection.query(
    'SELECT return_no FROM purchase_returns WHERE return_no LIKE ? ORDER BY id DESC',
    [`PR-${year}-%`]
  );
  let max = 0;
  rows.forEach(r => {
    const seq = parseInt(String(r.return_no).split('-')[2], 10);
    if (Number.isFinite(seq) && seq > max) max = seq;
  });
  return `PR-${year}-${String(max + 1).padStart(4, '0')}`;
};

const cleanText = (v, max) => {
  const s = v === undefined || v === null ? '' : String(v).trim();
  return s ? s.slice(0, max) : null;
};

const toYmd = (v) => {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Validates requested lines against what is pending (excluding this return's own lines when editing)
const buildLines = async (connection, rawLines, excludeReturnId = null) => {
  if (!Array.isArray(rawLines) || !rawLines.length) throw httpError('Select at least one rejected item to return.');
  const ids = [...new Set(rawLines.map(l => parseInt(l.qc_item_id, 10)).filter(Number.isFinite))];
  if (!ids.length) throw httpError('Select at least one rejected item to return.');
  const [rows] = await connection.query(`${PENDING_SQL} AND qci.id IN (?)`, [ids]);
  const byId = new Map(rows.map(r => [r.qc_item_id, r]));
  let own = new Map();
  if (excludeReturnId) {
    const [ownRows] = await connection.query(
      'SELECT qc_inspection_item_id, SUM(quantity) q, SUM(weight) w FROM purchase_return_items WHERE purchase_return_id = ? GROUP BY qc_inspection_item_id',
      [excludeReturnId]
    );
    own = new Map(ownRows.map(r => [r.qc_inspection_item_id, { q: parseFloat(r.q) || 0, w: parseFloat(r.w) || 0 }]));
  }
  let vendorId = null;
  let poId = null;
  let poNumber = null;
  let grnId = null;
  const lines = [];
  for (const l of rawLines) {
    const id = parseInt(l.qc_item_id, 10);
    const r = byId.get(id);
    if (!r) throw httpError(`QC line ${l.qc_item_id} has no rejected quantity to return.`);
    const p = shapePending(r);
    const mine = own.get(id) || { q: 0, w: 0 };
    const availQty = round3(p.pending_qty + mine.q);
    const availWt = round3(p.pending_weight + mine.w);
    const qty = round3(l.quantity);
    let wt = l.weight === undefined || l.weight === null || l.weight === '' ? null : round3(l.weight);
    if (wt === null) wt = availQty > 0 ? round3(availWt * (qty / availQty)) : availWt;
    if (qty < 0 || wt < 0) throw httpError(`${p.item_code}: quantity and weight cannot be negative.`);
    if (qty <= EPS && wt <= EPS) throw httpError(`${p.item_code}: enter the quantity or weight to return.`);
    if (qty > availQty + EPS) throw httpError(`${p.item_code}: return qty ${qty} is more than the rejected qty still to return (${availQty}).`);
    if (wt > availWt + EPS) throw httpError(`${p.item_code}: return weight ${wt} is more than the rejected weight still to return (${availWt}).`);
    if (vendorId === null) { vendorId = p.vendor_id; poId = p.po_id; poNumber = p.po_number; grnId = p.grn_id; }
    if (!p.vendor_id) throw httpError(`${p.item_code}: the supplier of this GRN could not be found.`);
    if (p.vendor_id !== vendorId) throw httpError('All items on one Purchase Return must be from the same supplier.');
    if ((p.po_id || null) !== (poId || null)) throw httpError('All items on one Purchase Return must be from the same Purchase Order.');
    const byWeight = isWeightUnit(p.unit) && wt > 0;
    lines.push({
      qc_item_id: id,
      qc_inspection_id: p.qc_inspection_id,
      grn_id: p.grn_id,
      grn_item_id: p.grn_item_id,
      po_item_id: p.po_item_id,
      item_code: p.item_code,
      description: cleanText(p.material_name || p.description, 500),
      size_text: cleanText(p.size_text, 200),
      quantity: qty,
      weight: wt,
      unit: p.unit,
      rate: p.rate,
      amount: round2(p.rate * (byWeight ? wt : qty)),
      remarks: cleanText(l.remarks !== undefined ? l.remarks : p.qc_remarks, 500)
    });
  }
  if (new Set(lines.map(l => l.qc_item_id)).size !== lines.length) throw httpError('The same rejected line was added twice.');
  return { lines, vendorId, poId, poNumber, grnId };
};

const insertLines = async (connection, returnId, lines) => {
  for (const l of lines) {
    await connection.query(
      `INSERT INTO purchase_return_items
         (purchase_return_id, qc_inspection_item_id, qc_inspection_id, grn_id, grn_item_id, po_item_id, item_code,
          description, size_text, quantity, weight, unit, rate, amount, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [returnId, l.qc_item_id, l.qc_inspection_id, l.grn_id, l.grn_item_id, l.po_item_id, l.item_code,
        l.description, l.size_text, l.quantity, l.weight, l.unit, l.rate, l.amount, l.remarks]
    );
  }
};

const headerValues = (body) => {
  const type = String(body.return_type || 'REPLACEMENT').toUpperCase();
  if (!RETURN_TYPES.includes(type)) throw httpError('Return type must be Replacement or Debit Note.');
  const reason = cleanText(body.reason, 2000);
  if (!reason) throw httpError('Enter the reason for the return.');
  return {
    return_date: toYmd(body.return_date) || toYmd(new Date()),
    return_type: type,
    reason,
    vehicle_no: cleanText(body.vehicle_no, 50),
    transporter: cleanText(body.transporter, 150),
    remarks: cleanText(body.remarks, 2000)
  };
};

const createReturn = async (body, userId = null) => {
  const h = headerValues(body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { lines, vendorId, poId, poNumber, grnId } = await buildLines(connection, body.lines);
    let companyId = null;
    try {
      companyId = await require('./companyChangeService').getGrnCompanyId(grnId);
    } catch (e) { companyId = null; }
    const returnNo = await nextReturnNo(connection);
    const [res] = await connection.query(
      `INSERT INTO purchase_returns
         (return_no, return_date, vendor_id, po_id, po_number, host_company_id, return_type, status, reason, vehicle_no, transporter, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)`,
      [returnNo, h.return_date, vendorId, poId, poNumber, companyId, h.return_type, h.reason, h.vehicle_no, h.transporter, h.remarks, userId]
    );
    await insertLines(connection, res.insertId, lines);
    await connection.commit();
    return getReturnById(res.insertId);
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
};

const lockReturn = async (connection, id) => {
  const [rows] = await connection.query('SELECT * FROM purchase_returns WHERE id = ? FOR UPDATE', [id]);
  if (!rows.length) throw httpError('Purchase Return not found', 404);
  return rows[0];
};

const updateReturn = async (id, body) => {
  const h = headerValues(body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const pr = await lockReturn(connection, id);
    if (pr.status !== 'DRAFT') throw httpError(`Only a Draft return can be edited (this one is ${pr.status}).`);
    if (body.lines !== undefined) {
      const { lines, vendorId, poId } = await buildLines(connection, body.lines, pr.id);
      if (vendorId !== pr.vendor_id || (poId || null) !== (pr.po_id || null)) {
        throw httpError('Items must stay from the same supplier and Purchase Order as this return.');
      }
      await connection.query('DELETE FROM purchase_return_items WHERE purchase_return_id = ?', [pr.id]);
      await insertLines(connection, pr.id, lines);
    }
    await connection.query(
      'UPDATE purchase_returns SET return_date = ?, return_type = ?, reason = ?, vehicle_no = ?, transporter = ?, remarks = ? WHERE id = ?',
      [h.return_date, h.return_type, h.reason, h.vehicle_no, h.transporter, h.remarks, pr.id]
    );
    await connection.commit();
    return getReturnById(pr.id);
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
};

const dispatchReturn = async (id, body = {}, userId = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const pr = await lockReturn(connection, id);
    if (pr.status !== 'DRAFT') throw httpError(`Only a Draft return can be dispatched (this one is ${pr.status}).`);
    const vehicle = cleanText(body.vehicle_no, 50) || pr.vehicle_no;
    const transporter = cleanText(body.transporter, 150) || pr.transporter;
    await connection.query(
      `UPDATE purchase_returns SET status = 'DISPATCHED', dispatched_at = NOW(), dispatched_by = ?, vehicle_no = ?, transporter = ? WHERE id = ?`,
      [userId, vehicle, transporter, pr.id]
    );
    await connection.commit();
    return getReturnById(pr.id);
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
};

const cancelReturn = async (id) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const pr = await lockReturn(connection, id);
    if (pr.status !== 'DRAFT') throw httpError(`Only a Draft return can be cancelled (this one is ${pr.status}).`);
    await connection.query("UPDATE purchase_returns SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = ?", [pr.id]);
    await connection.commit();
    return getReturnById(pr.id);
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
};

const LIST_SQL = `
  SELECT pr.*, v.vendor_name, v.vendor_code,
         COALESCE(SUM(pri.quantity), 0) AS total_qty, COALESCE(SUM(pri.weight), 0) AS total_weight,
         COALESCE(SUM(pri.amount), 0) AS total_amount, COUNT(pri.id) AS line_count,
         GROUP_CONCAT(DISTINCT pri.grn_id ORDER BY pri.grn_id) AS grn_ids
  FROM purchase_returns pr
  LEFT JOIN vendors v ON v.id = pr.vendor_id
  LEFT JOIN purchase_return_items pri ON pri.purchase_return_id = pr.id`;

const listReturns = async () => {
  const [rows] = await pool.query(`${LIST_SQL} GROUP BY pr.id ORDER BY pr.id DESC`);
  return rows.map(r => ({
    ...r,
    grn_ids: r.grn_ids ? String(r.grn_ids).split(',').map(Number) : [],
    total_qty: round3(r.total_qty),
    total_weight: round3(r.total_weight),
    total_amount: round2(r.total_amount)
  }));
};

const getReturnById = async (id) => {
  const [rows] = await pool.query(`${LIST_SQL} WHERE pr.id = ? GROUP BY pr.id`, [id]);
  if (!rows.length) return null;
  const r = rows[0];
  const [items] = await pool.query('SELECT * FROM purchase_return_items WHERE purchase_return_id = ? ORDER BY id', [id]);
  return {
    ...r,
    grn_ids: r.grn_ids ? String(r.grn_ids).split(',').map(Number) : [],
    total_qty: round3(r.total_qty),
    total_weight: round3(r.total_weight),
    total_amount: round2(r.total_amount),
    items: items.map(i => ({
      ...i,
      quantity: round3(i.quantity),
      weight: round3(i.weight),
      rate: round2(i.rate),
      amount: round2(i.amount),
      grn_no: i.grn_id ? `GRN-${String(i.grn_id).padStart(4, '0')}` : ''
    }))
  };
};

module.exports = {
  RETURN_TYPES,
  getPendingReturns,
  listReturns,
  getReturnById,
  createReturn,
  updateReturn,
  dispatchReturn,
  cancelReturn
};
