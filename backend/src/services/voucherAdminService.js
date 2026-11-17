const pool = require('../config/db');

// Payment History: cancel (reverse) and edit vouchers, with an audit trail.
// A voucher is never deleted: cancelling marks it CANCELLED, reverses its ledger entries and recomputes the
// documents it settled (sales invoice / PO status). Totals, statements, outstanding and bank balances only
// count CONFIRMED receipts / payments and non-cancelled journals / contras, so a cancelled voucher drops out.

const KINDS = {
  receipt: { table: 'customer_payments', noCol: 'payment_receipt_no', label: 'Receipt' },
  payment: { table: 'payments', noCol: 'payment_voucher_no', label: 'Payment' },
  journal: { table: 'journal_vouchers', noCol: 'voucher_no', label: 'Journal' },
  contra: { table: 'contra_vouchers', noCol: 'voucher_no', label: 'Contra' },
  'debit-note': { table: 'debit_notes', noCol: 'voucher_no', label: 'Debit Note' },
  'credit-note': { table: 'credit_notes', noCol: 'voucher_no', label: 'Credit Note' }
};

const badRequest = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const money = (n) => `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const toYmd = (v) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : null);

const getKind = (kind) => {
  const k = KINDS[String(kind || '').toLowerCase()];
  if (!k) throw badRequest(`Unknown voucher type "${kind}"`);
  return k;
};

const lockVoucher = async (conn, kind, id) => {
  const k = getKind(kind);
  const [rows] = await conn.query(`SELECT * FROM ${k.table} WHERE id = ? FOR UPDATE`, [id]);
  if (!rows.length) throw badRequest(`${k.label} not found`, 404);
  const row = rows[0];
  if (String(row.status || '').toUpperCase() === 'CANCELLED') {
    throw badRequest(`${k.label} ${row[k.noCol] || ''} is already cancelled`.replace(/\s+/g, ' ').trim());
  }
  return { k, row };
};

const bankName = async (conn, bankAccountId, fallback) => {
  if (!bankAccountId) return fallback || 'Cash';
  const [rows] = await conn.query('SELECT bank_name, account_number FROM bank_accounts WHERE id = ?', [bankAccountId]);
  return rows.length ? `${rows[0].bank_name}${rows[0].account_number ? ` (${rows[0].account_number})` : ''}` : (fallback || 'Bank');
};

// Adds the opposite entry for every ledger row a voucher posted (same pattern as debit / credit note cancel)
const reverseLedger = async (conn, ledgerTable, partyCol, docType, docId, description) => {
  const [rows] = await conn.query(
    `SELECT ${partyCol} AS party_id, transaction_type, amount FROM ${ledgerTable} WHERE reference_doc_type = ? AND reference_doc_id = ?`,
    [docType, docId]
  );
  for (const r of rows) {
    await conn.query(
      `INSERT INTO ${ledgerTable} (${partyCol}, reference_doc_id, reference_doc_type, transaction_type, amount, description, ledger_date)
       VALUES (?, ?, ?, ?, ?, ?, CURDATE())`,
      [r.party_id, docId, docType, String(r.transaction_type).toUpperCase() === 'DEBIT' ? 'CREDIT' : 'DEBIT', r.amount, description]
    );
  }
  return rows.length;
};

// Sales invoice status from what is still settled on it (confirmed receipts + posted credit notes)
const recomputeSalesInvoice = async (conn, invoiceId, effects) => {
  const [[inv]] = await conn.query('SELECT id, invoice_no, total_amount, status, sent_to_accounts FROM sales_invoices WHERE id = ?', [invoiceId]);
  if (!inv) return;
  const [[settled]] = await conn.query(
    `SELECT
       COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa JOIN customer_payments cp ON cpa.customer_payment_id = cp.id
                 WHERE cpa.invoice_id = ? AND cp.status = 'CONFIRMED'), 0)
     + COALESCE((SELECT SUM(cp.payment_amount) FROM customer_payments cp
                 WHERE (cp.invoice_id = ? OR (cp.sales_order_id = ? AND cp.sales_order_source = 'SALES_INVOICE')) AND cp.status = 'CONFIRMED'
                   AND NOT EXISTS (SELECT 1 FROM customer_payment_allocations x WHERE x.customer_payment_id = cp.id)), 0)
     + COALESCE((SELECT SUM(cn.total_amount) FROM credit_notes cn WHERE cn.sales_invoice_id = ? AND cn.status = 'POSTED'), 0) AS amount`,
    [invoiceId, invoiceId, invoiceId, invoiceId]
  );
  const total = Number(inv.total_amount) || 0;
  const done = Number(settled.amount) || 0;
  const current = String(inv.status || '');
  if (!['Paid', 'Partially Paid'].includes(current)) return; // only payment-driven statuses are recomputed
  const next = done >= total - 0.005 ? 'Paid' : (done > 0.005 ? 'Partially Paid' : (Number(inv.sent_to_accounts) ? 'Sent to Accounts' : 'Created'));
  if (next !== current) {
    await conn.query('UPDATE sales_invoices SET status = ?, updated_at = NOW() WHERE id = ?', [next, invoiceId]);
    effects.push(`${inv.invoice_no}: ${current} → ${next}`);
  }
};

// PO marked PAID goes back to Pending Payment when it is no longer fully paid
const recomputePurchaseOrder = async (conn, poId, effects) => {
  const [[po]] = await conn.query('SELECT id, po_number, total_amount, status FROM purchase_orders WHERE id = ?', [poId]);
  if (!po || String(po.status) !== 'PAID') return;
  const [[paid]] = await conn.query(
    `SELECT
       COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments p ON pa.payment_id = p.id WHERE pa.po_id = ? AND p.status = 'CONFIRMED'), 0)
     + COALESCE((SELECT SUM(p.payment_amount) FROM payments p WHERE p.po_id = ? AND p.status = 'CONFIRMED'
                 AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)), 0) AS amount`,
    [poId, poId]
  );
  if ((Number(paid.amount) || 0) < (Number(po.total_amount) || 0) - 0.005) {
    await conn.query("UPDATE purchase_orders SET status = 'PENDING_PAYMENT' WHERE id = ?", [poId]);
    effects.push(`${po.po_number}: PAID → Pending Payment`);
  }
};

const writeAudit = async (conn, { kind, id, voucherNo, action, reason, oldValues = null, newValues = null, effects = null, user = {} }) => {
  await conn.query(
    `INSERT INTO voucher_audit_log (voucher_kind, voucher_id, voucher_no, action, reason, old_values, new_values, effects, user_id, user_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [kind, id, voucherNo || null, action, reason || null,
      oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null,
      effects ? JSON.stringify(effects) : null, user.id || null, user.name || null]
  );
};

// ───────────────────────── Cancel ─────────────────────────

const cancelInTransaction = async (conn, kind, id, reason) => {
  const effects = [];
  const { k, row } = await lockVoucher(conn, kind, id);
  const voucherNo = row[k.noCol];

  if (kind === 'receipt') {
    const [allocs] = await conn.query('SELECT DISTINCT invoice_id FROM customer_payment_allocations WHERE customer_payment_id = ? AND invoice_id IS NOT NULL', [id]);
    const invoiceIds = new Set(allocs.map(a => a.invoice_id));
    if (row.invoice_id) invoiceIds.add(row.invoice_id);
    if (row.sales_order_source === 'SALES_INVOICE' && row.sales_order_id) invoiceIds.add(row.sales_order_id);
    await conn.query("UPDATE customer_payments SET status = 'CANCELLED', cancelled_at = NOW(), cancel_reason = ?, updated_at = NOW() WHERE id = ?", [reason, id]);
    await reverseLedger(conn, 'customer_ledger', 'customer_id', 'PAYMENT', id, `Cancellation of Receipt ${voucherNo}`);
    const [[c]] = await conn.query('SELECT company_name FROM companies WHERE id = ?', [row.customer_id]);
    effects.push(`${c?.company_name || 'Customer'} outstanding increases by ${money(row.payment_amount)}`);
    effects.push(`${await bankName(conn, row.bank_account_id, row.manual_bank_account)} balance decreases by ${money(row.payment_amount)}`);
    for (const invId of invoiceIds) await recomputeSalesInvoice(conn, invId, effects);
  } else if (kind === 'payment') {
    const [allocs] = await conn.query(
      `SELECT DISTINCT COALESCE(pa.po_id, vi.po_id) AS po_id FROM payment_allocations pa
       LEFT JOIN vendor_invoices vi ON vi.id = pa.invoice_id WHERE pa.payment_id = ?`,
      [id]
    );
    const poIds = new Set(allocs.map(a => a.po_id).filter(Boolean));
    if (row.po_id) poIds.add(row.po_id);
    await conn.query("UPDATE payments SET status = 'CANCELLED', cancelled_at = NOW(), cancel_reason = ?, updated_at = NOW() WHERE id = ?", [reason, id]);
    await reverseLedger(conn, 'vendor_ledger', 'vendor_id', 'PAYMENT', id, `Cancellation of Payment ${voucherNo}`);
    const [[v]] = await conn.query('SELECT vendor_name FROM vendors WHERE id = ?', [row.vendor_id]);
    effects.push(`${v?.vendor_name || 'Vendor'} payable increases by ${money(row.payment_amount)}`);
    effects.push(`${await bankName(conn, row.bank_account_id, row.manual_bank_account)} balance increases by ${money(row.payment_amount)}`);
    for (const poId of poIds) await recomputePurchaseOrder(conn, poId, effects);
    if (row.job_card_quality_log_id) {
      const [[ql]] = await conn.query('SELECT status FROM job_card_quality_logs WHERE id = ?', [row.job_card_quality_log_id]);
      if (ql && String(ql.status) === 'PAID') {
        await conn.query("UPDATE job_card_quality_logs SET status = 'APPROVED' WHERE id = ?", [row.job_card_quality_log_id]);
        effects.push('Job work bill: PAID → Approved');
      }
    }
  } else if (kind === 'journal') {
    await conn.query("UPDATE journal_vouchers SET status = 'CANCELLED', cancelled_at = NOW(), cancel_reason = ?, updated_at = NOW() WHERE id = ?", [reason, id]);
    await reverseLedger(conn, 'vendor_ledger', 'vendor_id', 'JOURNAL', id, `Cancellation of Journal ${voucherNo}`);
    const [lines] = await conn.query('SELECT ledger_account, debit_amount, credit_amount FROM journal_voucher_items WHERE journal_voucher_id = ? ORDER BY id', [id]);
    lines.forEach(l => effects.push(`Reversed: ${l.ledger_account} ${Number(l.debit_amount) > 0 ? `Dr ${money(l.debit_amount)}` : `Cr ${money(l.credit_amount)}`}`));
  } else if (kind === 'contra') {
    await conn.query("UPDATE contra_vouchers SET status = 'CANCELLED', cancelled_at = NOW(), cancel_reason = ?, updated_at = NOW() WHERE id = ?", [reason, id]);
    effects.push(`${row.from_account} gets back ${money(row.amount)}`);
    effects.push(`${row.to_account} balance decreases by ${money(row.amount)}`);
  } else if (kind === 'debit-note' || kind === 'credit-note') {
    // Debit / credit notes keep their existing cancel; here only the reason is stored and the effect described
    const party = kind === 'debit-note'
      ? (await conn.query('SELECT vendor_name AS name FROM vendors WHERE id = ?', [row.vendor_id]))[0][0]
      : (await conn.query('SELECT company_name AS name FROM companies WHERE id = ?', [row.customer_id]))[0][0];
    effects.push(kind === 'debit-note'
      ? `${party?.name || 'Vendor'} payable increases by ${money(row.total_amount)}`
      : `${party?.name || 'Customer'} outstanding increases by ${money(row.total_amount)}`);
    if (row.reference_invoice_no) effects.push(`${row.reference_invoice_no}: note amount no longer deducted`);
  }
  return { k, row, voucherNo, effects };
};

const previewCancel = async (kind, id) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { k, row, voucherNo, effects } = await cancelInTransaction(conn, kind, id, 'preview');
    return { kind, id: Number(id), voucherNo, label: k.label, amount: Number(row.payment_amount ?? row.amount ?? row.total_amount ?? row.total_debit) || 0, effects };
  } finally {
    await conn.rollback(); // preview only: nothing is saved
    conn.release();
  }
};

const cancelVoucher = async (kind, id, reason, user = {}) => {
  const why = String(reason || '').trim();
  if (why.length < 3) throw badRequest('Please enter the reason for cancelling (at least 3 characters)');

  if (kind === 'debit-note' || kind === 'credit-note') {
    const preview = await previewCancel(kind, id);
    const service = kind === 'debit-note' ? require('./paymentService') : require('./creditNoteService');
    await (kind === 'debit-note' ? service.cancelDebitNote(id) : service.cancelCreditNote(id));
    const conn = await pool.getConnection();
    try {
      await conn.query(`UPDATE ${KINDS[kind].table} SET cancel_reason = ? WHERE id = ?`, [why, id]);
      await writeAudit(conn, { kind, id, voucherNo: preview.voucherNo, action: 'CANCEL', reason: why, effects: preview.effects, user });
    } finally {
      conn.release();
    }
    return { ...preview, status: 'CANCELLED' };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { k, row, voucherNo, effects } = await cancelInTransaction(conn, kind, id, why);
    await writeAudit(conn, { kind, id, voucherNo, action: 'CANCEL', reason: why, effects, user });
    await conn.commit();
    return { kind, id: Number(id), voucherNo, label: k.label, status: 'CANCELLED', amount: Number(row.payment_amount ?? row.amount) || 0, effects };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ───────────────────────── Edit ─────────────────────────

// Field (request body) → column, per voucher type. Amount / allocation changes on receipts and payments
// are not edited in place: cancel the voucher and record it again so every settled document is recomputed.
const EDITABLE = {
  receipt: { paymentDate: 'payment_date', paymentMode: 'payment_mode', bankAccountId: 'bank_account_id', transactionRefNo: 'transaction_ref_no', chequeNumber: 'cheque_number', chequeDate: 'cheque_date', remarks: 'remarks' },
  payment: { paymentDate: 'payment_date', paymentMode: 'payment_mode', bankAccountId: 'bank_account_id', transactionRefNo: 'transaction_ref_no', chequeNumber: 'cheque_number', chequeDate: 'cheque_date', remarks: 'remarks' },
  journal: { voucherDate: 'voucher_date', referenceNo: 'reference_no', narration: 'narration' },
  contra: { voucherDate: 'voucher_date', amount: 'amount', referenceNo: 'reference_no', narration: 'narration' }
};
const DATE_COLS = new Set(['payment_date', 'cheque_date', 'voucher_date']);

const updateVoucher = async (kind, id, body = {}, user = {}) => {
  if (kind === 'debit-note' || kind === 'credit-note') {
    throw badRequest(`${KINDS[kind].label}s cannot be edited (GST document). Cancel it and issue a new one.`);
  }
  const fields = EDITABLE[kind];
  if (!fields) throw badRequest(`Unknown voucher type "${kind}"`);
  const why = String(body.reason || '').trim();
  if (why.length < 3) throw badRequest('Please enter the reason for this change (at least 3 characters)');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { k, row } = await lockVoucher(conn, kind, id);
    const oldValues = {};
    const newValues = {};
    for (const [key, col] of Object.entries(fields)) {
      if (body[key] === undefined) continue;
      let value = body[key];
      if (DATE_COLS.has(col)) {
        value = value ? String(value).slice(0, 10) : null;
        if (value && !isIsoDate(value)) throw badRequest(`Invalid date for ${key}`);
        if (!value && col !== 'cheque_date') throw badRequest('Date is required');
      } else if (col === 'amount') {
        value = Math.round((parseFloat(value) || 0) * 100) / 100;
        if (value <= 0) throw badRequest('Amount must be greater than zero');
      } else if (col === 'bank_account_id') {
        value = value === '' || value === null ? null : parseInt(value, 10);
        if (value) {
          const [b] = await conn.query('SELECT id FROM bank_accounts WHERE id = ?', [value]);
          if (!b.length) throw badRequest('Selected bank account not found');
        }
      } else {
        value = value === null ? null : String(value).trim();
      }
      const current = DATE_COLS.has(col) ? toYmd(row[col]) : (col === 'amount' ? Number(row[col]) : row[col]);
      if (String(current ?? '') !== String(value ?? '')) {
        oldValues[col] = current ?? null;
        newValues[col] = value;
      }
    }
    if (!Object.keys(newValues).length) throw badRequest('Nothing was changed');

    const sets = Object.keys(newValues).map(col => `${col} = ?`);
    await conn.query(`UPDATE ${k.table} SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, [...Object.values(newValues), id]);

    // Keep ledger dates in step with the voucher date
    const newDate = newValues.payment_date || newValues.voucher_date;
    if (newDate) {
      if (kind === 'receipt') await conn.query("UPDATE customer_ledger SET ledger_date = ? WHERE reference_doc_type = 'PAYMENT' AND reference_doc_id = ? AND description NOT LIKE 'Cancellation%'", [newDate, id]);
      if (kind === 'payment') await conn.query("UPDATE vendor_ledger SET ledger_date = ? WHERE reference_doc_type = 'PAYMENT' AND reference_doc_id = ? AND description NOT LIKE 'Cancellation%'", [newDate, id]);
      if (kind === 'journal') await conn.query("UPDATE vendor_ledger SET ledger_date = ? WHERE reference_doc_type = 'JOURNAL' AND reference_doc_id = ? AND description NOT LIKE 'Cancellation%'", [newDate, id]);
    }

    await writeAudit(conn, { kind, id, voucherNo: row[k.noCol], action: 'EDIT', reason: why, oldValues, newValues, user });
    await conn.commit();
    return { kind, id: Number(id), voucherNo: row[k.noCol], changed: newValues };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ───────────────────────── Full edit on the voucher entry screen ─────────────────────────

// Receipt / payment with its bill allocations, in the shape the voucher entry screen pre-fills from
const SCREEN_KINDS = ['receipt', 'payment', 'journal', 'contra'];

// Journal lines as the voucher entry screen holds them: { ledger, debit, credit, partyId, partyName }.
// The save logic stores a party row as "<ledger> (<party name>)", so the party is matched back by name.
const journalScreenRows = async (journalId) => {
  const [items] = await pool.query('SELECT ledger_account, debit_amount, credit_amount FROM journal_voucher_items WHERE journal_voucher_id = ? ORDER BY id', [journalId]);
  const out = [];
  for (const it of items) {
    const label = String(it.ledger_account || '');
    let row = { ledger: label, partyId: '', partyName: '' };
    const m = label.match(/^(.*\S)\s*\(([^()]+)\)$/);
    if (m) {
      const isVendor = /creditor|vendor|supplier/i.test(m[1]);
      const [hit] = isVendor
        ? await pool.query('SELECT id FROM vendors WHERE vendor_name = ? LIMIT 1', [m[2].trim()])
        : await pool.query('SELECT id FROM companies WHERE company_name = ? LIMIT 1', [m[2].trim()]);
      if (hit.length) row = { ledger: m[1], partyId: String(hit[0].id), partyName: m[2].trim() };
    }
    const dr = Number(it.debit_amount) || 0;
    const cr = Number(it.credit_amount) || 0;
    out.push({ ...row, debit: dr > 0 ? dr.toFixed(2) : '', credit: cr > 0 ? cr.toFixed(2) : '' });
  }
  return out;
};

const getEditData = async (kind, id) => {
  if (!SCREEN_KINDS.includes(kind)) throw badRequest('Only receipts, payments, journals and contras open in the voucher entry screen');
  const k = getKind(kind);
  const [rows] = await pool.query(`SELECT * FROM ${k.table} WHERE id = ?`, [id]);
  if (!rows.length) throw badRequest(`${k.label} not found`, 404);
  const v = rows[0];
  if (String(v.status || '').toUpperCase() === 'CANCELLED') throw badRequest(`${k.label} ${v[k.noCol]} is cancelled and cannot be edited`);

  if (kind === 'journal') {
    return {
      kind, id: v.id, voucherNo: v.voucher_no, hostCompanyId: v.host_company_id,
      date: toYmd(v.voucher_date), referenceNo: v.reference_no || '', narration: v.narration || '',
      amount: Number(v.total_debit) || 0, rows: await journalScreenRows(v.id)
    };
  }
  if (kind === 'contra') {
    return {
      kind, id: v.id, voucherNo: v.voucher_no, hostCompanyId: v.host_company_id,
      date: toYmd(v.voucher_date), referenceNo: v.reference_no || '', narration: v.narration || '',
      amount: Number(v.amount) || 0, fromAccount: v.from_account, toAccount: v.to_account,
      fromBankAccountId: v.from_bank_account_id, toBankAccountId: v.to_bank_account_id
    };
  }

  let allocations = [];
  if (kind === 'receipt') {
    const [a] = await pool.query(
      `SELECT invoice_id, sales_order_id, sales_order_source, allocation_type, reference_no, amount
       FROM customer_payment_allocations WHERE customer_payment_id = ? ORDER BY id`,
      [id]
    );
    allocations = a.map(r => ({ type: r.allocation_type || 'Agst Ref', invoiceId: r.invoice_id, salesOrderId: r.sales_order_id, salesOrderSource: r.sales_order_source, referenceNo: r.reference_no, amount: Number(r.amount) || 0 }));
    const directInvoiceId = v.invoice_id || (v.sales_order_source === 'SALES_INVOICE' ? v.sales_order_id : null);
    if (!allocations.length && directInvoiceId) {
      allocations = [{ type: 'Agst Ref', invoiceId: directInvoiceId, salesOrderId: v.sales_order_id, salesOrderSource: v.sales_order_source, referenceNo: null, amount: Number(v.payment_amount) || 0 }];
    }
  } else {
    const [a] = await pool.query(
      `SELECT pa.invoice_id, COALESCE(pa.po_id, vi.po_id) AS po_id, pa.allocation_type, pa.reference_no, pa.amount,
              COALESCE(pa.invoice_id, (SELECT vi2.id FROM vendor_invoices vi2 WHERE vi2.po_id = pa.po_id ORDER BY vi2.id LIMIT 1)) AS bill_id
       FROM payment_allocations pa LEFT JOIN vendor_invoices vi ON vi.id = pa.invoice_id WHERE pa.payment_id = ? ORDER BY pa.id`,
      [id]
    );
    allocations = a.map(r => ({ type: r.allocation_type || 'Agst Ref', billId: r.bill_id, poId: r.po_id, referenceNo: r.reference_no, amount: Number(r.amount) || 0 }));
    if (!allocations.length && v.po_id) {
      const [[bill]] = await pool.query('SELECT id FROM vendor_invoices WHERE po_id = ? ORDER BY id LIMIT 1', [v.po_id]);
      allocations = [{ type: 'Agst Ref', billId: bill?.id || null, poId: v.po_id, referenceNo: null, amount: Number(v.payment_amount) || 0 }];
    }
  }

  // Allocation option the screen opens on (Agst Ref / Advance / On Account / New Ref)
  const types = allocations.map(a => String(a.type || '').toLowerCase());
  const remarks = String(v.remarks || '');
  let option = 'AGST_REF';
  if (types.includes('advance') || /^\[Advance/i.test(remarks)) option = 'ADVANCE';
  else if (types.includes('on account') || /^\[On Account\]/i.test(remarks)) option = 'ON_ACCOUNT';
  else if (types.includes('new ref') || /^\[New Ref:/i.test(remarks)) option = 'NEW_REF';

  return {
    kind,
    id: v.id,
    voucherNo: v[k.noCol],
    partyId: kind === 'receipt' ? v.customer_id : v.vendor_id,
    hostCompanyId: v.host_company_id,
    amount: Number(v.payment_amount) || 0,
    paymentDate: toYmd(v.payment_date),
    paymentMode: v.payment_mode,
    bankAccountId: v.bank_account_id,
    manualBankAccount: v.manual_bank_account,
    transactionRefNo: v.transaction_ref_no,
    chequeNumber: v.cheque_number,
    chequeDate: toYmd(v.cheque_date),
    upiApp: v.upi_app,
    upiTransactionId: v.upi_transaction_id,
    remarks: v.remarks,
    option,
    allocations
  };
};

// Replace a receipt / payment with the corrected entry from the voucher entry screen, keeping its voucher no.:
// the old copy is cancelled (reversed) and renamed, the corrected one recorded by the normal save logic,
// all in one transaction (nothing changes if any step fails)
const replaceVoucher = async (kind, id, payload = {}, user = {}) => {
  if (!SCREEN_KINDS.includes(kind)) throw badRequest('Only receipts, payments, journals and contras can be edited on the voucher entry screen');
  const why = String(payload.editReason || '').trim();
  if (why.length < 3) throw badRequest('Please enter the reason for this change (at least 3 characters)');
  const { editReason, ...entry } = payload;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { k, row, voucherNo, effects } = await cancelInTransaction(conn, kind, id, `Edited: ${why}`);
    const archivedNo = `${voucherNo}/X${id}`;
    const hostCompanyId = entry.hostCompanyId ?? row.host_company_id;

    let created;
    if (kind === 'receipt') {
      await conn.query('UPDATE customer_payments SET payment_receipt_no = ? WHERE id = ?', [archivedNo, id]);
      await conn.query('UPDATE payment_receipts SET receipt_no = ? WHERE payment_id = ?', [archivedNo, id]);
      await conn.query('UPDATE customer_payment_allocations SET receipt_no = ? WHERE customer_payment_id = ?', [archivedNo, id]);
      const customerPaymentService = require('./customerPaymentService');
      created = await customerPaymentService.recordPaymentReceived({ ...entry, hostCompanyId, receiptNoOverride: voucherNo, createdBy: user.id || row.created_by }, conn);
    } else if (kind === 'journal' || kind === 'contra') {
      await conn.query(`UPDATE ${k.table} SET voucher_no = ? WHERE id = ?`, [archivedNo, id]);
      const paymentService = require('./paymentService');
      const save = kind === 'journal' ? paymentService.recordJournalVoucher : paymentService.recordContraVoucher;
      created = await save({ ...entry, hostCompanyId, voucherNo, createdBy: user.id || row.created_by }, conn);
      const [[fresh]] = await conn.query(`SELECT voucher_no AS no, voucher_date FROM ${k.table} WHERE id = ?`, [created.id]);
      if (!fresh || fresh.no !== voucherNo) throw badRequest('Could not keep the same voucher number; nothing was changed');
      const amountCol = kind === 'journal' ? 'total_debit' : 'amount';
      const [[nw]] = await conn.query(`SELECT ${amountCol} AS amount, voucher_date, reference_no, narration FROM ${k.table} WHERE id = ?`, [created.id]);
      const oldValues = { amount: Number(row[amountCol]), voucher_date: toYmd(row.voucher_date), reference_no: row.reference_no, narration: row.narration };
      const newValues = { amount: Number(nw.amount), voucher_date: toYmd(nw.voucher_date), reference_no: nw.reference_no, narration: nw.narration };
      await writeAudit(conn, { kind, id, voucherNo: archivedNo, action: 'EDIT', reason: why, oldValues, newValues: { ...newValues, replaced_by_id: created.id }, effects, user });
      await writeAudit(conn, { kind, id: created.id, voucherNo, action: 'EDIT', reason: why, oldValues, newValues, effects, user });
      await conn.commit();
      return { kind, id: created.id, previousId: Number(id), voucherNo, label: k.label };
    } else {
      await conn.query('UPDATE payments SET payment_voucher_no = ? WHERE id = ?', [archivedNo, id]);
      await conn.query('UPDATE payment_vouchers SET voucher_no = ? WHERE payment_id = ?', [archivedNo, id]);
      await conn.query('UPDATE payment_allocations SET voucher_no = ? WHERE payment_id = ?', [archivedNo, id]);
      const paymentService = require('./paymentService');
      created = await paymentService.processPayment({ ...entry, hostCompanyId, voucherNumber: voucherNo, createdBy: user.id || row.created_by }, conn);
    }
    const newId = created.id;
    const [[fresh]] = await conn.query(`SELECT payment_amount, payment_date, ${k.noCol} AS no FROM ${k.table} WHERE id = ?`, [newId]);
    if (!fresh || fresh.no !== voucherNo) throw badRequest('Could not keep the same voucher number; nothing was changed');

    const oldValues = { amount: Number(row.payment_amount), payment_date: toYmd(row.payment_date), payment_mode: row.payment_mode, bank_account_id: row.bank_account_id, remarks: row.remarks };
    const newValues = { amount: Number(fresh.payment_amount), payment_date: toYmd(fresh.payment_date), payment_mode: entry.paymentMode, bank_account_id: entry.bankAccountId ?? entry.bankAccount ?? null, remarks: entry.remarks || entry.narration || null };
    await writeAudit(conn, { kind, id, voucherNo: archivedNo, action: 'EDIT', reason: why, oldValues, newValues: { ...newValues, replaced_by_id: newId }, effects, user });
    await writeAudit(conn, { kind, id: newId, voucherNo, action: 'EDIT', reason: why, oldValues, newValues, effects, user });
    await conn.commit();
    return { kind, id: newId, previousId: Number(id), voucherNo, label: k.label };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const getAuditTrail = async (kind, id) => {
  getKind(kind);
  const [rows] = await pool.query(
    'SELECT id, action, reason, old_values, new_values, effects, user_name, created_at FROM voucher_audit_log WHERE voucher_kind = ? AND voucher_id = ? ORDER BY id DESC',
    [kind, id]
  );
  const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
  return rows.map(r => ({ ...r, old_values: parse(r.old_values), new_values: parse(r.new_values), effects: parse(r.effects) }));
};

module.exports = {
  KINDS,
  previewCancel,
  cancelVoucher,
  updateVoucher,
  getEditData,
  replaceVoucher,
  getAuditTrail
};
