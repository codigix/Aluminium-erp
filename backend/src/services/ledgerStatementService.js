// Ledger Statement (Tally "Ledger Vouchers" view) — read-only.
//
// Built from the POSTED vouchers themselves (same sources as Payment History), because the
// customer_ledger / vendor_ledger tables are not complete (sales invoices and purchase bills never post there):
//   Customer : Sales Invoice (sent to Accounts) Dr · Receipt Cr · Credit Note Cr · Journal line Dr/Cr
//   Supplier : Purchase Bill Cr · Payment Dr · Debit Note Dr · Journal line Dr/Cr
//   Bank     : Opening balance · Receipt Dr · Payment Cr · Contra in Dr / out Cr
//   Cash     : Cash receipts Dr · cash payments Cr · Contra to/from cash
//   Other    : Journal lines on that ledger · DN/CN taxable value on their affected ledger
// Excluded: draft / cancelled / not-yet-sent documents. Nothing is written.
const pool = require('../config/db');
const { BILL_SQL } = (() => {
  // Same bill amount + bill company rules as Accounts → Vendor Invoices (vendorInvoiceService)
  const BILL_AMOUNT_SQL = `(CASE WHEN CAST(vi.invoice_amount AS DECIMAL(14,2)) > 0 THEN vi.invoice_amount ELSE vi.po_amount END)`;
  const HOST_COMPANY_SQL = `COALESCE(
      (SELECT hpo.host_company_id FROM purchase_orders hpo WHERE hpo.id = vi.po_id LIMIT 1),
      (SELECT q.host_company_id FROM purchase_orders hpo JOIN quotations q ON q.id = hpo.quotation_id WHERE hpo.id = vi.po_id LIMIT 1),
      (SELECT hp.host_company_id FROM payments hp
        WHERE hp.status = 'CONFIRMED' AND hp.host_company_id IS NOT NULL
          AND (hp.po_id = vi.po_id OR EXISTS (SELECT 1 FROM payment_allocations hpa WHERE hpa.payment_id = hp.id AND (hpa.po_id = vi.po_id OR hpa.invoice_id = vi.id)))
        ORDER BY hp.id LIMIT 1),
      (SELECT hd.host_company_id FROM debit_notes hd
        WHERE hd.status = 'POSTED' AND hd.host_company_id IS NOT NULL
          AND (hd.vendor_invoice_id = vi.id OR (hd.vendor_invoice_id IS NULL AND hd.po_id = vi.po_id))
        ORDER BY hd.id LIMIT 1)
    )`;
  return {
    BILL_SQL: `SELECT vi.id, vi.vendor_id, vi.po_id, vi.po_number, vi.vendor_invoice_no, vi.status,
                      COALESCE(NULLIF(vi.vendor_invoice_no, ''), vi.po_number, CONCAT('BILL-', vi.id)) AS display_invoice_no,
                      COALESCE(vi.invoice_date, vi.po_date, vi.created_at) AS bill_date,
                      ${BILL_AMOUNT_SQL} AS bill_amount, vi.gst_amount, vi.created_at,
                      ${HOST_COMPANY_SQL} AS host_company_id, v.vendor_name
               FROM vendor_invoices vi JOIN vendors v ON v.id = vi.vendor_id`
  };
})();

const LEDGER_TYPES = ['CUSTOMER', 'SUPPLIER', 'BANK', 'CASH', 'OTHER'];
const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
const num = (v) => round2(v);

const httpError = (message, status = 400) => {
  const e = new Error(message);
  e.status = status;
  e.statusCode = status;
  return e;
};

// DATE / DATETIME → 'YYYY-MM-DD' (local date, like the rest of the ERP)
const ymd = (v) => {
  if (!v) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const p = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : ymd(d);
};

const isCashMode = (mode) => /cash/i.test(String(mode || ''));
const showCash = (t) => String(t || '').replace(/Cash in Hand/gi, 'Cash');

// Party name inside a journal ledger: 'Sundry Debtors (Customers) (ACME LTD)' → 'ACME LTD'
const jvParty = (acc) => {
  const m = String(acc || '').match(/\(([^()]*)\)\s*$/);
  return m ? m[1].trim() : '';
};
const isDebtorLedger = (acc) => /sundry debtors|customer/i.test(acc || '');
const isCreditorLedger = (acc) => /sundry creditors|vendor/i.test(acc || '');

// Tally sorts a day's vouchers by entry; keep invoices/bills before the receipts/payments against them
const TYPE_ORDER = { Sales: 1, Purchase: 1, Journal: 2, 'Credit Note': 3, 'Debit Note': 3, Receipt: 4, Payment: 4, Contra: 5 };

const entry = (e) => ({
  date: ymd(e.date),
  particulars: e.particulars || '—',
  sub: e.sub || null,
  voucher_type: e.voucher_type,
  voucher_no: e.voucher_no || '—',
  ref_no: e.ref_no || null,
  debit: e.debit > 0 ? round2(e.debit) : 0,
  credit: e.credit > 0 ? round2(e.credit) : 0,
  narration: e.narration || null,
  host_company_id: e.host_company_id ?? null,
  doc: e.doc, // { kind, id } → GET /ledger-statement/voucher
  created_at: e.created_at || null
});

const bankLabelOf = (row) => {
  if (row.bank_name) return row.account_number ? `${row.bank_name} (${row.account_number})` : row.bank_name;
  if (row.manual_bank_account) return row.manual_bank_account;
  return isCashMode(row.payment_mode) ? 'Cash' : 'Bank Account';
};

// ───────────────────────── entries per ledger type ─────────────────────────

const journalLines = async (match) => {
  const [rows] = await pool.query(
    `SELECT jv.id, jv.voucher_no, jv.voucher_date, jv.reference_no, jv.narration, jv.host_company_id, jv.created_at,
            jvi.id AS item_id, jvi.ledger_account, jvi.debit_amount, jvi.credit_amount
     FROM journal_vouchers jv JOIN journal_voucher_items jvi ON jvi.journal_voucher_id = jv.id
     ORDER BY jv.id, jvi.id`
  );
  const byVoucher = new Map();
  rows.forEach(r => { if (!byVoucher.has(r.id)) byVoucher.set(r.id, []); byVoucher.get(r.id).push(r); });
  const out = [];
  byVoucher.forEach(lines => {
    lines.filter(l => match(l.ledger_account)).forEach(l => {
      const others = lines.filter(o => o.item_id !== l.item_id).map(o => o.ledger_account);
      out.push(entry({
        date: l.voucher_date || l.created_at,
        particulars: others.join(', ') || 'Journal',
        sub: l.ledger_account,
        voucher_type: 'Journal',
        voucher_no: l.voucher_no || `JV-${l.id}`,
        ref_no: l.reference_no,
        debit: parseFloat(l.debit_amount) || 0,
        credit: parseFloat(l.credit_amount) || 0,
        narration: l.narration,
        host_company_id: l.host_company_id,
        doc: { kind: 'JOURNAL', id: l.id },
        created_at: l.created_at
      }));
    });
  });
  return out;
};

const customerEntries = async (customerId) => {
  const [[cust]] = await pool.query('SELECT id, company_name FROM companies WHERE id = ?', [customerId]);
  if (!cust) throw httpError('Customer not found', 404);
  const list = [];

  const [inv] = await pool.query(
    `SELECT si.id, si.invoice_no, si.invoice_date, si.customer_po_no, si.total_amount, si.subtotal, si.notes, si.created_at,
            COALESCE(si.host_company_id, o.host_company_id) AS host_company_id, o.order_no
     FROM sales_invoices si LEFT JOIN orders o ON o.id = si.order_id
     WHERE si.client_id = ? AND si.sent_to_accounts = 1`,
    [customerId]
  );
  inv.forEach(r => list.push(entry({
    date: r.invoice_date || r.created_at, particulars: 'Sales (G.S.T.)', sub: r.order_no ? `SO ${r.order_no}` : null,
    voucher_type: 'Sales', voucher_no: r.invoice_no, ref_no: r.customer_po_no ? `PO ${r.customer_po_no}` : null,
    debit: parseFloat(r.total_amount) || 0, host_company_id: r.host_company_id,
    doc: { kind: 'SALES_INVOICE', id: r.id }, created_at: r.created_at
  })));

  const [rec] = await pool.query(
    `SELECT cp.*, b.bank_name, b.account_number, si.invoice_no
     FROM customer_payments cp
     LEFT JOIN bank_accounts b ON b.id = cp.bank_account_id
     LEFT JOIN sales_invoices si ON si.id = cp.invoice_id
     WHERE cp.customer_id = ? AND cp.status = 'CONFIRMED'`,
    [customerId]
  );
  rec.forEach(r => list.push(entry({
    date: r.payment_date || r.created_at, particulars: bankLabelOf(r), sub: r.payment_mode,
    voucher_type: 'Receipt', voucher_no: r.payment_receipt_no || `PR-${r.id}`,
    ref_no: r.invoice_no || r.cheque_number || r.transaction_ref_no,
    credit: parseFloat(r.payment_amount) || 0, narration: r.remarks, host_company_id: r.host_company_id,
    doc: { kind: 'RECEIPT', id: r.id }, created_at: r.created_at
  })));

  const [cns] = await pool.query("SELECT * FROM credit_notes WHERE customer_id = ? AND status = 'POSTED'", [customerId]);
  cns.forEach(r => list.push(entry({
    date: r.voucher_date || r.created_at, particulars: r.affected_ledger || 'Credit Note', sub: r.reason,
    voucher_type: 'Credit Note', voucher_no: r.voucher_no, ref_no: r.reference_invoice_no,
    credit: parseFloat(r.total_amount) || 0, narration: r.narration, host_company_id: r.host_company_id,
    doc: { kind: 'CREDIT_NOTE', id: r.id }, created_at: r.created_at
  })));

  const name = String(cust.company_name || '').trim().toLowerCase();
  list.push(...await journalLines(acc => isDebtorLedger(acc) && jvParty(acc).toLowerCase() === name));
  return { ledger: { type: 'CUSTOMER', id: cust.id, name: cust.company_name, group: 'Sundry Debtors' }, opening: 0, entries: list };
};

const supplierEntries = async (vendorId) => {
  const [[ven]] = await pool.query('SELECT id, vendor_name FROM vendors WHERE id = ?', [vendorId]);
  if (!ven) throw httpError('Supplier not found', 404);
  const list = [];

  const [bills] = await pool.query(`${BILL_SQL} WHERE vi.vendor_id = ?`, [vendorId]);
  bills.forEach(r => list.push(entry({
    date: r.bill_date || r.created_at, particulars: 'Purchase @ GST', sub: r.po_number ? `PO ${r.po_number}` : null,
    voucher_type: 'Purchase', voucher_no: r.display_invoice_no, ref_no: r.po_number,
    credit: parseFloat(r.bill_amount) || 0, host_company_id: r.host_company_id,
    doc: { kind: 'PURCHASE_BILL', id: r.id }, created_at: r.created_at
  })));

  const [pays] = await pool.query(
    `SELECT p.*, b.bank_name, b.account_number, po.po_number
     FROM payments p
     LEFT JOIN bank_accounts b ON b.id = p.bank_account_id
     LEFT JOIN purchase_orders po ON po.id = p.po_id
     WHERE p.vendor_id = ? AND p.status = 'CONFIRMED'`,
    [vendorId]
  );
  pays.forEach(r => list.push(entry({
    date: r.payment_date || r.created_at, particulars: bankLabelOf(r), sub: r.payment_mode,
    voucher_type: 'Payment', voucher_no: r.payment_voucher_no || `PAY-${r.id}`,
    ref_no: r.po_number || r.cheque_number || r.transaction_ref_no,
    debit: parseFloat(r.payment_amount) || 0, narration: r.remarks, host_company_id: r.host_company_id,
    doc: { kind: 'PAYMENT', id: r.id }, created_at: r.created_at
  })));

  const [dns] = await pool.query("SELECT * FROM debit_notes WHERE vendor_id = ? AND status = 'POSTED'", [vendorId]);
  dns.forEach(r => list.push(entry({
    date: r.voucher_date || r.created_at, particulars: r.affected_ledger || 'Debit Note', sub: r.reason,
    voucher_type: 'Debit Note', voucher_no: r.voucher_no, ref_no: r.reference_invoice_no,
    debit: parseFloat(r.total_amount) || 0, narration: r.narration, host_company_id: r.host_company_id,
    doc: { kind: 'DEBIT_NOTE', id: r.id }, created_at: r.created_at
  })));

  const name = String(ven.vendor_name || '').trim().toLowerCase();
  list.push(...await journalLines(acc => isCreditorLedger(acc) && jvParty(acc).toLowerCase() === name));
  return { ledger: { type: 'SUPPLIER', id: ven.id, name: ven.vendor_name, group: 'Sundry Creditors' }, opening: 0, entries: list };
};

const bankEntries = async (bankId) => {
  const [[bank]] = await pool.query('SELECT * FROM bank_accounts WHERE id = ?', [bankId]);
  if (!bank) throw httpError('Bank account not found', 404);
  const list = [];

  const [rec] = await pool.query(
    `SELECT cp.*, c.company_name, si.invoice_no FROM customer_payments cp
     LEFT JOIN companies c ON c.id = cp.customer_id LEFT JOIN sales_invoices si ON si.id = cp.invoice_id
     WHERE cp.bank_account_id = ? AND cp.status = 'CONFIRMED'`, [bankId]);
  rec.forEach(r => list.push(entry({
    date: r.payment_date || r.created_at, particulars: r.company_name || 'Customer', sub: r.payment_mode,
    voucher_type: 'Receipt', voucher_no: r.payment_receipt_no || `PR-${r.id}`, ref_no: r.invoice_no || r.cheque_number || r.transaction_ref_no,
    debit: parseFloat(r.payment_amount) || 0, narration: r.remarks, host_company_id: r.host_company_id,
    doc: { kind: 'RECEIPT', id: r.id }, created_at: r.created_at
  })));

  const [pays] = await pool.query(
    `SELECT p.*, v.vendor_name, po.po_number FROM payments p
     LEFT JOIN vendors v ON v.id = p.vendor_id LEFT JOIN purchase_orders po ON po.id = p.po_id
     WHERE p.bank_account_id = ? AND p.status = 'CONFIRMED'`, [bankId]);
  pays.forEach(r => list.push(entry({
    date: r.payment_date || r.created_at, particulars: r.vendor_name || 'Supplier', sub: r.payment_mode,
    voucher_type: 'Payment', voucher_no: r.payment_voucher_no || `PAY-${r.id}`, ref_no: r.po_number || r.cheque_number || r.transaction_ref_no,
    credit: parseFloat(r.payment_amount) || 0, narration: r.remarks, host_company_id: r.host_company_id,
    doc: { kind: 'PAYMENT', id: r.id }, created_at: r.created_at
  })));

  const [cvs] = await pool.query('SELECT * FROM contra_vouchers WHERE from_bank_account_id = ? OR to_bank_account_id = ?', [bankId, bankId]);
  cvs.forEach(r => {
    const amt = parseFloat(r.amount) || 0;
    if (String(r.to_bank_account_id) === String(bankId)) list.push(entry({
      date: r.voucher_date || r.created_at, particulars: showCash(r.from_account) || 'Cash / Bank', sub: 'Contra – money in',
      voucher_type: 'Contra', voucher_no: r.voucher_no || `CV-${r.id}`, ref_no: r.reference_no, debit: amt,
      narration: showCash(r.narration), host_company_id: r.host_company_id, doc: { kind: 'CONTRA', id: r.id }, created_at: r.created_at
    }));
    if (String(r.from_bank_account_id) === String(bankId)) list.push(entry({
      date: r.voucher_date || r.created_at, particulars: showCash(r.to_account) || 'Cash / Bank', sub: 'Contra – money out',
      voucher_type: 'Contra', voucher_no: r.voucher_no || `CV-${r.id}`, ref_no: r.reference_no, credit: amt,
      narration: showCash(r.narration), host_company_id: r.host_company_id, doc: { kind: 'CONTRA', id: r.id }, created_at: r.created_at
    }));
  });

  return {
    ledger: { type: 'BANK', id: bank.id, name: bank.account_number ? `${bank.bank_name} (${bank.account_number})` : bank.bank_name, group: 'Bank Accounts' },
    opening: round2(bank.opening_balance), // Dr
    entries: list
  };
};

const cashEntries = async () => {
  const list = [];
  const [rec] = await pool.query(
    `SELECT cp.*, c.company_name FROM customer_payments cp LEFT JOIN companies c ON c.id = cp.customer_id
     WHERE cp.status = 'CONFIRMED' AND cp.bank_account_id IS NULL AND cp.payment_mode LIKE '%CASH%'`);
  rec.forEach(r => list.push(entry({
    date: r.payment_date || r.created_at, particulars: r.company_name || 'Customer', sub: 'Cash receipt',
    voucher_type: 'Receipt', voucher_no: r.payment_receipt_no || `PR-${r.id}`, ref_no: r.transaction_ref_no,
    debit: parseFloat(r.payment_amount) || 0, narration: r.remarks, host_company_id: r.host_company_id,
    doc: { kind: 'RECEIPT', id: r.id }, created_at: r.created_at
  })));
  const [pays] = await pool.query(
    `SELECT p.*, v.vendor_name FROM payments p LEFT JOIN vendors v ON v.id = p.vendor_id
     WHERE p.status = 'CONFIRMED' AND p.bank_account_id IS NULL AND p.payment_mode LIKE '%CASH%'`);
  pays.forEach(r => list.push(entry({
    date: r.payment_date || r.created_at, particulars: r.vendor_name || 'Supplier', sub: 'Cash payment',
    voucher_type: 'Payment', voucher_no: r.payment_voucher_no || `PAY-${r.id}`, ref_no: r.transaction_ref_no,
    credit: parseFloat(r.payment_amount) || 0, narration: r.remarks, host_company_id: r.host_company_id,
    doc: { kind: 'PAYMENT', id: r.id }, created_at: r.created_at
  })));
  const [cvs] = await pool.query('SELECT * FROM contra_vouchers');
  cvs.forEach(r => {
    const amt = parseFloat(r.amount) || 0;
    const toCash = !r.to_bank_account_id && /cash/i.test(r.to_account || '');
    const fromCash = !r.from_bank_account_id && /cash/i.test(r.from_account || '');
    if (toCash) list.push(entry({
      date: r.voucher_date || r.created_at, particulars: showCash(r.from_account), sub: 'Contra – money in',
      voucher_type: 'Contra', voucher_no: r.voucher_no || `CV-${r.id}`, ref_no: r.reference_no, debit: amt,
      narration: showCash(r.narration), host_company_id: r.host_company_id, doc: { kind: 'CONTRA', id: r.id }, created_at: r.created_at
    }));
    if (fromCash) list.push(entry({
      date: r.voucher_date || r.created_at, particulars: showCash(r.to_account), sub: 'Contra – money out',
      voucher_type: 'Contra', voucher_no: r.voucher_no || `CV-${r.id}`, ref_no: r.reference_no, credit: amt,
      narration: showCash(r.narration), host_company_id: r.host_company_id, doc: { kind: 'CONTRA', id: r.id }, created_at: r.created_at
    }));
  });
  return { ledger: { type: 'CASH', id: 'CASH', name: 'Cash', group: 'Cash-in-Hand' }, opening: 0, entries: list };
};

const otherEntries = async (ledgerName) => {
  const name = String(ledgerName || '').trim();
  if (!name) throw httpError('Select a ledger');
  const lc = name.toLowerCase();
  const list = await journalLines(acc => String(acc || '').trim().toLowerCase() === lc);
  // Debit Note: Cr its affected ledger (e.g. Purchase Returns) with the taxable value; Credit Note: Dr
  const [dns] = await pool.query(
    `SELECT dn.*, v.vendor_name FROM debit_notes dn LEFT JOIN vendors v ON v.id = dn.vendor_id
     WHERE dn.status = 'POSTED' AND LOWER(TRIM(dn.affected_ledger)) = ?`, [lc]);
  dns.forEach(r => list.push(entry({
    date: r.voucher_date || r.created_at, particulars: r.vendor_name || 'Supplier', sub: r.reason,
    voucher_type: 'Debit Note', voucher_no: r.voucher_no, ref_no: r.reference_invoice_no,
    credit: parseFloat(r.taxable_amount) || 0, narration: r.narration, host_company_id: r.host_company_id,
    doc: { kind: 'DEBIT_NOTE', id: r.id }, created_at: r.created_at
  })));
  const [cns] = await pool.query(
    `SELECT cn.*, c.company_name FROM credit_notes cn LEFT JOIN companies c ON c.id = cn.customer_id
     WHERE cn.status = 'POSTED' AND LOWER(TRIM(cn.affected_ledger)) = ?`, [lc]);
  cns.forEach(r => list.push(entry({
    date: r.voucher_date || r.created_at, particulars: r.company_name || 'Customer', sub: r.reason,
    voucher_type: 'Credit Note', voucher_no: r.voucher_no, ref_no: r.reference_invoice_no,
    debit: parseFloat(r.taxable_amount) || 0, narration: r.narration, host_company_id: r.host_company_id,
    doc: { kind: 'CREDIT_NOTE', id: r.id }, created_at: r.created_at
  })));
  return { ledger: { type: 'OTHER', id: name, name, group: 'General Ledger' }, opening: 0, entries: list };
};

// ───────────────────────── public API ─────────────────────────

// Ledgers to choose from, grouped like Tally
const getLedgerOptions = async () => {
  const [customers] = await pool.query(
    `SELECT c.id, c.company_name AS name FROM companies c
     WHERE EXISTS (SELECT 1 FROM sales_invoices si WHERE si.client_id = c.id AND si.sent_to_accounts = 1)
        OR EXISTS (SELECT 1 FROM customer_payments cp WHERE cp.customer_id = c.id AND cp.status = 'CONFIRMED')
        OR EXISTS (SELECT 1 FROM credit_notes cn WHERE cn.customer_id = c.id AND cn.status = 'POSTED')
     ORDER BY c.company_name`);
  const [allCustomers] = await pool.query('SELECT id, company_name AS name FROM companies ORDER BY company_name');
  const [suppliers] = await pool.query(
    `SELECT v.id, v.vendor_name AS name FROM vendors v
     WHERE EXISTS (SELECT 1 FROM vendor_invoices vi WHERE vi.vendor_id = v.id)
        OR EXISTS (SELECT 1 FROM payments p WHERE p.vendor_id = v.id AND p.status = 'CONFIRMED')
        OR EXISTS (SELECT 1 FROM debit_notes dn WHERE dn.vendor_id = v.id AND dn.status = 'POSTED')
     ORDER BY v.vendor_name`);
  const [allSuppliers] = await pool.query('SELECT id, vendor_name AS name FROM vendors ORDER BY vendor_name');
  const [banks] = await pool.query('SELECT id, bank_name, account_number, is_active FROM bank_accounts ORDER BY bank_name');
  const [jv] = await pool.query('SELECT DISTINCT TRIM(ledger_account) AS name FROM journal_voucher_items WHERE ledger_account IS NOT NULL');
  const [dnL] = await pool.query("SELECT DISTINCT TRIM(affected_ledger) AS name FROM debit_notes WHERE status = 'POSTED' AND affected_ledger IS NOT NULL");
  const [cnL] = await pool.query("SELECT DISTINCT TRIM(affected_ledger) AS name FROM credit_notes WHERE status = 'POSTED' AND affected_ledger IS NOT NULL");
  const others = [...new Set([...jv, ...dnL, ...cnL].map(r => r.name).filter(n => n && !isDebtorLedger(n) && !isCreditorLedger(n)))].sort();
  const withActivity = new Set(customers.map(c => c.id));
  const supActivity = new Set(suppliers.map(s => s.id));
  return {
    customers: allCustomers.map(c => ({ ...c, has_entries: withActivity.has(c.id) })),
    suppliers: allSuppliers.map(s => ({ ...s, has_entries: supActivity.has(s.id) })),
    banks: banks.map(b => ({ id: b.id, name: b.account_number ? `${b.bank_name} (${b.account_number})` : b.bank_name, is_active: b.is_active })),
    cash: [{ id: 'CASH', name: 'Cash' }],
    others: others.map(n => ({ id: n, name: n }))
  };
};

const getLedgerStatement = async ({ ledgerType, ledgerId, hostCompanyId, from, to }) => {
  const type = String(ledgerType || '').toUpperCase();
  if (!LEDGER_TYPES.includes(type)) throw httpError('Select a ledger type');
  let data;
  if (type === 'CUSTOMER') data = await customerEntries(ledgerId);
  else if (type === 'SUPPLIER') data = await supplierEntries(ledgerId);
  else if (type === 'BANK') data = await bankEntries(ledgerId);
  else if (type === 'CASH') data = await cashEntries();
  else data = await otherEntries(ledgerId);

  // Company-wise: that company's vouchers (older vouchers saved without a company stay visible, as elsewhere in Accounts)
  let entries = data.entries.filter(e => e.date && (e.debit > 0 || e.credit > 0));
  if (hostCompanyId) entries = entries.filter(e => e.host_company_id == null || String(e.host_company_id) === String(hostCompanyId));

  entries.sort((a, b) =>
    a.date.localeCompare(b.date) ||
    (TYPE_ORDER[a.voucher_type] || 9) - (TYPE_ORDER[b.voucher_type] || 9) ||
    String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
    String(a.voucher_no).localeCompare(String(b.voucher_no), undefined, { numeric: true }));

  const fromD = ymd(from);
  const toD = ymd(to);
  // Balance kept as Dr − Cr (positive = Dr)
  let opening = round2(data.opening);
  const before = fromD ? entries.filter(e => e.date < fromD) : [];
  before.forEach(e => { opening = round2(opening + e.debit - e.credit); });
  const inPeriod = entries.filter(e => (!fromD || e.date >= fromD) && (!toD || e.date <= toD));

  let bal = opening;
  const rows = inPeriod.map((e, i) => {
    bal = round2(bal + e.debit - e.credit);
    return { ...e, sr: i + 1, balance: bal };
  });
  const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));
  const byType = {};
  rows.forEach(r => {
    const t = byType[r.voucher_type] || (byType[r.voucher_type] = { count: 0, debit: 0, credit: 0 });
    t.count += 1; t.debit = round2(t.debit + r.debit); t.credit = round2(t.credit + r.credit);
  });
  return {
    ledger: data.ledger,
    period: { from: fromD, to: toD },
    host_company_id: hostCompanyId || null,
    opening_balance: opening,
    total_debit: totalDebit,
    total_credit: totalCredit,
    closing_balance: round2(opening + totalDebit - totalCredit),
    by_type: byType,
    rows
  };
};

// Original voucher behind a statement row (read-only)
const getVoucher = async (kind, id) => {
  const K = String(kind || '').toUpperCase();
  const one = async (sql, params) => { const [r] = await pool.query(sql, params); return r[0] || null; };
  let header = null;
  let lines = [];
  if (K === 'SALES_INVOICE') {
    header = await one(`SELECT si.*, c.company_name AS party_name, o.order_no FROM sales_invoices si
                        LEFT JOIN companies c ON c.id = si.client_id LEFT JOIN orders o ON o.id = si.order_id WHERE si.id = ?`, [id]);
    [lines] = await pool.query('SELECT item_code, drawing_no, description, invoice_qty AS quantity, uom AS unit, unit_rate AS rate, amount FROM sales_invoice_items WHERE sales_invoice_id = ? ORDER BY id', [id]);
  } else if (K === 'PURCHASE_BILL') {
    header = await one(`${BILL_SQL} WHERE vi.id = ?`, [id]);
    if (header) [lines] = await pool.query('SELECT item_code, material_name AS description, quantity, COALESCE(unit, uom) AS unit, unit_rate AS rate, amount FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id', [header.po_id]);
  } else if (K === 'RECEIPT') {
    header = await one(`SELECT cp.*, c.company_name AS party_name, b.bank_name, b.account_number, si.invoice_no FROM customer_payments cp
                        LEFT JOIN companies c ON c.id = cp.customer_id LEFT JOIN bank_accounts b ON b.id = cp.bank_account_id
                        LEFT JOIN sales_invoices si ON si.id = cp.invoice_id WHERE cp.id = ?`, [id]);
    [lines] = await pool.query('SELECT allocation_type AS description, reference_no AS item_code, amount FROM customer_payment_allocations WHERE customer_payment_id = ? ORDER BY id', [id]);
  } else if (K === 'PAYMENT') {
    header = await one(`SELECT p.*, v.vendor_name AS party_name, b.bank_name, b.account_number, po.po_number FROM payments p
                        LEFT JOIN vendors v ON v.id = p.vendor_id LEFT JOIN bank_accounts b ON b.id = p.bank_account_id
                        LEFT JOIN purchase_orders po ON po.id = p.po_id WHERE p.id = ?`, [id]);
    [lines] = await pool.query('SELECT allocation_type AS description, reference_no AS item_code, amount FROM payment_allocations WHERE payment_id = ? ORDER BY id', [id]);
  } else if (K === 'DEBIT_NOTE') {
    header = await one('SELECT dn.*, v.vendor_name AS party_name FROM debit_notes dn LEFT JOIN vendors v ON v.id = dn.vendor_id WHERE dn.id = ?', [id]);
    [lines] = await pool.query('SELECT item_code, description, quantity, unit, rate, taxable_amount AS amount, gst_amount, total_amount FROM debit_note_items WHERE debit_note_id = ? ORDER BY id', [id]);
  } else if (K === 'CREDIT_NOTE') {
    header = await one('SELECT cn.*, c.company_name AS party_name FROM credit_notes cn LEFT JOIN companies c ON c.id = cn.customer_id WHERE cn.id = ?', [id]);
    try { [lines] = await pool.query('SELECT * FROM credit_note_items WHERE credit_note_id = ? ORDER BY id', [id]); } catch (e) { lines = []; }
  } else if (K === 'JOURNAL') {
    header = await one('SELECT * FROM journal_vouchers WHERE id = ?', [id]);
    [lines] = await pool.query('SELECT ledger_account AS description, debit_amount AS debit, credit_amount AS credit FROM journal_voucher_items WHERE journal_voucher_id = ? ORDER BY id', [id]);
  } else if (K === 'CONTRA') {
    header = await one('SELECT * FROM contra_vouchers WHERE id = ?', [id]);
    if (header) lines = [
      { description: showCash(header.to_account), debit: header.amount, credit: 0 },
      { description: showCash(header.from_account), debit: 0, credit: header.amount }
    ];
  } else {
    throw httpError('Unknown voucher type');
  }
  if (!header) throw httpError('Voucher not found', 404);
  return { kind: K, header, lines };
};

module.exports = { getLedgerOptions, getLedgerStatement, getVoucher, LEDGER_TYPES };
