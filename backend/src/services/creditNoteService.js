const pool = require('../config/db');

const CREDIT_NOTE_REASONS = {
  SALES_RETURN: 'Sales Return',
  QUALITY_REJECTION: 'Quality Rejection by Customer',
  SHORT_SUPPLY: 'Short Supply',
  RATE_DIFFERENCE: 'Rate Difference',
  DISCOUNT: 'Discount / Rebate',
  OTHER: 'Other Adjustment'
};

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
const round3 = (n) => Math.round((parseFloat(n) || 0) * 1000) / 1000;

// errorHandler reads err.status
const badRequest = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

// Same receipt logic as customerPaymentService.getOutstandingInvoices
const PAID_SQL = `(COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa JOIN customer_payments cp ON cpa.customer_payment_id = cp.id WHERE cpa.invoice_id = si.id AND cp.status = 'CONFIRMED'), 0) +
       COALESCE((SELECT SUM(cp.payment_amount) FROM customer_payments cp WHERE (cp.invoice_id = si.id OR (cp.sales_order_id = si.id AND cp.sales_order_source = 'SALES_INVOICE')) AND cp.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM customer_payment_allocations cpa WHERE cpa.customer_payment_id = cp.id)), 0))`;
const CREDIT_NOTE_SQL = `COALESCE((SELECT SUM(cn.total_amount) FROM credit_notes cn WHERE cn.sales_invoice_id = si.id AND cn.status = 'POSTED'), 0)`;

const getInvoices = async (where, params) => {
  const [rows] = await pool.query(
    `SELECT si.id, si.invoice_no, si.invoice_date, si.client_id, si.customer_po_no,
            si.subtotal, si.cgst_rate, si.sgst_rate, si.igst_rate, si.total_amount,
            ${PAID_SQL} as paid_amount,
            ${CREDIT_NOTE_SQL} as credit_note_amount,
            (si.total_amount - ${PAID_SQL} - ${CREDIT_NOTE_SQL}) as outstanding
     FROM sales_invoices si
     WHERE ${where}
     ORDER BY si.invoice_date DESC, si.id DESC`,
    params
  );
  return rows;
};

// Invoice items (drawings) with already credited qty
const getInvoiceItems = async (invoiceIds) => {
  if (!invoiceIds.length) return [];
  const [rows] = await pool.query(
    `SELECT sii.id, sii.sales_invoice_id, sii.drawing_no, sii.item_code, sii.description, sii.hsn_code,
            COALESCE(sii.uom, 'Nos') as uom, sii.invoice_qty,
            CASE WHEN sii.unit_rate > 0 THEN sii.unit_rate ELSE COALESCE(oi.rate, 0) END as rate,
            COALESCE(r.returned_qty, 0) as returned_qty
     FROM sales_invoice_items sii
     LEFT JOIN order_items oi ON oi.id = sii.order_item_id
     LEFT JOIN (
       SELECT cni.sales_invoice_item_id, SUM(cni.quantity) as returned_qty
       FROM credit_note_items cni
       JOIN credit_notes cn ON cn.id = cni.credit_note_id
       WHERE cn.status = 'POSTED' AND cni.sales_invoice_item_id IS NOT NULL
       GROUP BY cni.sales_invoice_item_id
     ) r ON r.sales_invoice_item_id = sii.id
     WHERE sii.sales_invoice_id IN (?)
     ORDER BY sii.id`,
    [invoiceIds]
  );
  return rows.map(it => ({
    ...it,
    returnable_qty: Math.max(0, round3((parseFloat(it.invoice_qty) || 0) - (parseFloat(it.returned_qty) || 0)))
  }));
};

const getCreditNoteSources = async (customerId) => {
  if (!customerId) throw badRequest('customerId is required.');
  const invoices = await getInvoices(`si.client_id = ? AND si.sent_to_accounts = 1 AND si.status != 'Cancelled'`, [customerId]);
  const items = await getInvoiceItems(invoices.map(i => i.id));
  return invoices.map(inv => ({ ...inv, items: items.filter(it => it.sales_invoice_id === inv.id) }));
};

const generateNextCreditNoteNo = async () => {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(`SELECT voucher_no FROM credit_notes WHERE voucher_no LIKE ?`, [`CN-${year}-%`]);
  let maxSeq = 0;
  for (const r of rows) {
    const match = r.voucher_no && r.voucher_no.match(/CN-\d+-(\d+)/i);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `CN-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
};

const recordCreditNote = async (payload) => {
  const {
    date,
    customerId,
    salesInvoiceId,
    reason = 'SALES_RETURN',
    entryMode = 'ITEM',
    affectedLedger,
    gstType = 'INTRA',
    items = [],
    ledgerAmount,
    ledgerGstPercent,
    narration,
    bankAccountId,
    hostCompanyId,
    createdBy
  } = payload;

  if (!customerId) throw badRequest('Customer is required for a Credit Note.');
  if (!CREDIT_NOTE_REASONS[reason]) throw badRequest('Invalid credit note reason.');
  if (!['INTRA', 'INTER', 'NONE'].includes(gstType)) throw badRequest('Invalid GST type.');
  if (!['ITEM', 'LEDGER'].includes(entryMode)) throw badRequest('Invalid entry mode.');

  const [customerRows] = await pool.query('SELECT id, company_name FROM companies WHERE id = ?', [customerId]);
  if (customerRows.length === 0) throw badRequest('Customer not found.');
  const customer = customerRows[0];

  let bankAccount = null;
  if (bankAccountId) {
    const [bankRows] = await pool.query('SELECT id, bank_name, account_number FROM bank_accounts WHERE id = ?', [bankAccountId]);
    if (bankRows.length === 0) throw badRequest('Selected bank account not found.');
    bankAccount = bankRows[0];
  }

  // Reference invoice is optional – an on-account credit note reduces only the customer balance
  let invoice = null;
  if (salesInvoiceId) {
    [invoice] = await getInvoices('si.id = ?', [salesInvoiceId]);
    if (!invoice) throw badRequest('Reference invoice not found.');
    if (String(invoice.client_id) !== String(customerId)) {
      throw badRequest('Reference invoice does not belong to the selected customer.');
    }
  }
  if (entryMode === 'ITEM' && !invoice) {
    throw badRequest('Item-wise credit note requires a reference invoice.');
  }

  // Amounts are always recomputed on the server
  const gstEnabled = gstType !== 'NONE';
  let lines;
  if (entryMode === 'ITEM') {
    const invItems = new Map((await getInvoiceItems([invoice.id])).map(it => [String(it.id), it]));
    lines = items
      .filter(it => parseFloat(it.quantity) > 0)
      .map(it => {
        const invItem = invItems.get(String(it.invoiceItemId));
        if (!invItem) throw badRequest('One of the items is not part of the reference invoice.');
        const qty = parseFloat(it.quantity);
        if (qty > invItem.returnable_qty + 0.0005) {
          throw badRequest(`Qty for drawing ${invItem.drawing_no || invItem.item_code || ''} exceeds returnable qty ${invItem.returnable_qty}.`);
        }
        const rate = parseFloat(it.rate) || 0;
        const gstPercent = gstEnabled ? (parseFloat(it.gstPercent) || 0) : 0;
        const taxable = round2(qty * rate);
        const gstAmt = round2(taxable * gstPercent / 100);
        return {
          invoiceItemId: invItem.id,
          drawingNo: invItem.drawing_no || null,
          itemCode: invItem.item_code || null,
          description: (invItem.description || '').trim() || null,
          quantity: qty,
          unit: invItem.uom || null,
          rate,
          gstPercent,
          taxable,
          gstAmt,
          total: round2(taxable + gstAmt)
        };
      });
    if (lines.length === 0) throw badRequest('Enter a return quantity for at least one item.');
  } else {
    const taxable = round2(ledgerAmount);
    if (taxable <= 0) throw badRequest('Credit amount must be greater than 0.');
    const gstPercent = gstEnabled ? (parseFloat(ledgerGstPercent) || 0) : 0;
    const gstAmt = round2(taxable * gstPercent / 100);
    lines = [{
      invoiceItemId: null,
      drawingNo: null,
      itemCode: null,
      description: affectedLedger || CREDIT_NOTE_REASONS[reason],
      quantity: 1,
      unit: null,
      rate: taxable,
      gstPercent,
      taxable,
      gstAmt,
      total: round2(taxable + gstAmt)
    }];
  }

  const taxableAmount = round2(lines.reduce((s, l) => s + l.taxable, 0));
  const gstTotal = round2(lines.reduce((s, l) => s + l.gstAmt, 0));
  const cgst = gstType === 'INTRA' ? round2(gstTotal / 2) : 0;
  const sgst = gstType === 'INTRA' ? round2(gstTotal - cgst) : 0;
  const igst = gstType === 'INTER' ? gstTotal : 0;
  const totalAmount = round2(taxableAmount + gstTotal);

  if (totalAmount <= 0) throw badRequest('Credit note total must be greater than 0.');
  // An invoice can be credited up to its value (less earlier CNs). If already received,
  // the outstanding goes negative = amount payable / refundable to the customer.
  if (invoice) {
    const creditable = (parseFloat(invoice.total_amount) || 0) - (parseFloat(invoice.credit_note_amount) || 0);
    if (totalAmount > creditable + 0.01) {
      throw badRequest(`Credit note total (₹${totalAmount.toFixed(2)}) exceeds the invoice value available for credit (₹${creditable.toFixed(2)}).`);
    }
  }

  const ledgerName = affectedLedger || (reason === 'SALES_RETURN' ? 'Sales Returns' : 'Sales Accounts');
  const voucherDate = date || new Date().toISOString().split('T')[0];
  const invoiceRef = invoice ? invoice.invoice_no : null;
  const finalNarration = narration || `${CREDIT_NOTE_REASONS[reason]} – Credit note to ${customer.company_name}${invoiceRef ? ` against ${invoiceRef}` : ''}`;
  const voucherNo = await generateNextCreditNoteNo();

  // Company: a credit note against an invoice always belongs to that invoice's company (or its order's);
  // the company chosen on the page applies only to notes with no invoice (or an invoice with no company)
  let resolvedHostCompanyId = null;
  if (invoice) {
    const [hostRows] = await pool.query(
      `SELECT COALESCE(si.host_company_id, o.host_company_id) AS host_company_id
       FROM sales_invoices si LEFT JOIN orders o ON o.id = si.order_id WHERE si.id = ?`,
      [invoice.id]
    );
    resolvedHostCompanyId = hostRows[0]?.host_company_id || null;
  }
  if (!resolvedHostCompanyId) resolvedHostCompanyId = parseInt(hostCompanyId, 10) || null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO credit_notes (
        voucher_no, voucher_date, customer_id, sales_invoice_id, bank_account_id, reference_invoice_no,
        reason, entry_mode, affected_ledger, gst_type, taxable_amount, cgst_amount, sgst_amount,
        igst_amount, total_amount, narration, status, host_company_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?, ?)`,
      [
        voucherNo, voucherDate, customerId, invoice ? invoice.id : null, bankAccount ? bankAccount.id : null, invoiceRef,
        reason, entryMode, ledgerName, gstType, taxableAmount, cgst, sgst,
        igst, totalAmount, finalNarration, resolvedHostCompanyId, createdBy || null
      ]
    );
    const creditNoteId = result.insertId;

    for (const l of lines) {
      await connection.query(
        `INSERT INTO credit_note_items (
          credit_note_id, sales_invoice_item_id, drawing_no, item_code, description, quantity, unit, rate,
          gst_percent, taxable_amount, gst_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [creditNoteId, l.invoiceItemId, l.drawingNo, l.itemCode, l.description, l.quantity, l.unit, l.rate, l.gstPercent, l.taxable, l.gstAmt, l.total]
      );
    }

    // Customer A/c is credited → receivable reduces (CREDIT in customer_ledger, same as a receipt)
    await connection.query(
      `INSERT INTO customer_ledger (
        customer_id, reference_doc_id, reference_doc_type, transaction_type, amount, description, ledger_date
      ) VALUES (?, ?, 'CREDIT_NOTE', 'CREDIT', ?, ?, ?)`,
      [customerId, creditNoteId, totalAmount, `Credit Note ${voucherNo}: ${finalNarration}`, voucherDate]
    );

    await connection.commit();
    return {
      id: creditNoteId,
      voucherNo,
      voucherDate,
      customerName: customer.company_name,
      referenceInvoiceNo: invoiceRef,
      bankName: bankAccount ? bankAccount.bank_name : null,
      taxableAmount,
      cgst,
      sgst,
      igst,
      totalAmount,
      narration: finalNarration
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

const getCreditNotes = async (customerId = null) => {
  const params = [];
  let where = '';
  if (customerId) {
    where = 'WHERE cn.customer_id = ?';
    params.push(customerId);
  }
  const [rows] = await pool.query(
    `SELECT cn.*, c.company_name as customer_name, c.gstin as customer_gstin,
            ba.bank_name, ba.account_number as bank_account_number,
            COALESCE(
              (
                SELECT JSON_ARRAYAGG(
                  JSON_OBJECT(
                    'id', cni.id,
                    'sales_invoice_item_id', cni.sales_invoice_item_id,
                    'drawing_no', cni.drawing_no,
                    'item_code', cni.item_code,
                    'description', cni.description,
                    'quantity', cni.quantity,
                    'unit', cni.unit,
                    'rate', cni.rate,
                    'gst_percent', cni.gst_percent,
                    'taxable_amount', cni.taxable_amount,
                    'gst_amount', cni.gst_amount,
                    'total_amount', cni.total_amount
                  )
                )
                FROM credit_note_items cni
                WHERE cni.credit_note_id = cn.id
              ), '[]'
            ) as items
     FROM credit_notes cn
     JOIN companies c ON cn.customer_id = c.id
     LEFT JOIN bank_accounts ba ON cn.bank_account_id = ba.id
     ${where}
     ORDER BY cn.voucher_date DESC, cn.id DESC`,
    params
  );
  return rows.map(r => ({
    ...r,
    reason_label: CREDIT_NOTE_REASONS[r.reason] || r.reason,
    items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || [])
  }));
};

const cancelCreditNote = async (creditNoteId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM credit_notes WHERE id = ? FOR UPDATE', [creditNoteId]);
    if (rows.length === 0) throw badRequest('Credit note not found.');
    const cn = rows[0];
    if (cn.status === 'CANCELLED') throw badRequest('Credit note is already cancelled.');

    await connection.query(
      `UPDATE credit_notes SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [creditNoteId]
    );
    // Reverse the customer ledger effect
    await connection.query(
      `INSERT INTO customer_ledger (
        customer_id, reference_doc_id, reference_doc_type, transaction_type, amount, description, ledger_date
      ) VALUES (?, ?, 'CREDIT_NOTE', 'DEBIT', ?, ?, CURDATE())`,
      [cn.customer_id, cn.id, cn.total_amount, `Cancellation of Credit Note ${cn.voucher_no}`]
    );
    await connection.commit();
    return { id: cn.id, voucherNo: cn.voucher_no, status: 'CANCELLED' };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

module.exports = {
  getCreditNoteSources,
  generateNextCreditNoteNo,
  recordCreditNote,
  getCreditNotes,
  cancelCreditNote
};
