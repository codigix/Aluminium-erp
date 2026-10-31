const pool = require('../config/db');

// Shared SQL fragments: bill amount, confirmed payments and posted debit notes against a vendor bill
const BILL_AMOUNT_SQL = `(CASE WHEN CAST(vi.invoice_amount AS DECIMAL(14,2)) > 0 THEN vi.invoice_amount ELSE vi.po_amount END)`;
const PAID_SQL = `(
        COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments p ON pa.payment_id = p.id WHERE pa.po_id = vi.po_id AND p.status = 'CONFIRMED'), 0) +
        COALESCE((SELECT SUM(p.payment_amount) FROM payments p WHERE p.po_id = vi.po_id AND p.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)), 0)
      )`;
// Includes DNs raised against the PO before it was forwarded to Accounts as a bill
const DEBIT_NOTE_SQL = `COALESCE((SELECT SUM(dn.total_amount) FROM debit_notes dn WHERE dn.status = 'POSTED' AND (dn.vendor_invoice_id = vi.id OR (dn.vendor_invoice_id IS NULL AND dn.po_id = vi.po_id))), 0)`;

// Host company of a bill = host company of the quotation its purchase order was raised from.
// When the quotation has none (older data), fall back to the company of the confirmed payment,
// then of the posted debit note, recorded against the bill, so one company's bill never shows under another.
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

const VENDOR_INVOICE_SELECT = `SELECT
      vi.id,
      ${HOST_COMPANY_SQL} as host_company_id,
      vi.po_id,
      vi.po_number,
      vi.po_date,
      vi.vendor_id,
      vi.project_name,
      vi.mr_number,
      vi.drawing_no,
      vi.payment_terms,
      vi.po_pdf_path,
      vi.po_amount,
      COALESCE(NULLIF(vi.vendor_invoice_no, ''), vi.po_number, CONCAT('BILL-', vi.id)) as display_invoice_no,
      vi.vendor_invoice_no,
      COALESCE(vi.invoice_date, vi.po_date, vi.created_at) as bill_date,
      vi.invoice_date,
      vi.invoice_amount,
      ${BILL_AMOUNT_SQL} as bill_amount,
      vi.gst_amount,
      vi.invoice_pdf_path,
      vi.created_at,
      vi.updated_at,
      v.vendor_name,
      v.email as vendor_email,
      v.gstin as vendor_gstin,
      ${PAID_SQL} as already_paid,
      ${DEBIT_NOTE_SQL} as debit_note_amount,
      (${BILL_AMOUNT_SQL} - ${PAID_SQL} - ${DEBIT_NOTE_SQL}) as outstanding,
      CASE
        WHEN (${BILL_AMOUNT_SQL} - ${PAID_SQL} - ${DEBIT_NOTE_SQL}) <= 0 THEN 'COMPLETED'
        ELSE vi.status
      END as status
     FROM vendor_invoices vi
     JOIN vendors v ON vi.vendor_id = v.id`;

const getVendorInvoices = async (vendorId = null, hostCompanyId = null) => {
  let query = VENDOR_INVOICE_SELECT;

  const conditions = [];
  const params = [];
  if (vendorId) {
    conditions.push('vi.vendor_id = ?');
    params.push(vendorId);
  }
  // Bills with no company on their quotation, payments or debit notes (older data) stay visible under every company
  if (hostCompanyId) {
    conditions.push(`(${HOST_COMPANY_SQL} = ? OR ${HOST_COMPANY_SQL} IS NULL)`);
    params.push(hostCompanyId);
  }
  if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
  query += ` ORDER BY vi.created_at DESC`;

  const [rows] = await pool.query(query, params);
  return rows;
};

const getVendorInvoiceById = async (id) => {
  const [invoices] = await pool.query(
    `${VENDOR_INVOICE_SELECT}
     WHERE vi.id = ?`,
    [id]
  );

  if (invoices.length === 0) return null;
  const invoice = invoices[0];

  // Fetch PO items
  const [items] = await pool.query(
    `SELECT * FROM purchase_order_items WHERE purchase_order_id = ?`,
    [invoice.po_id]
  );

  // Fetch payments list
  const [payments] = await pool.query(
    `SELECT p.*, COALESCE(pa.amount, p.payment_amount) as allocated_amount 
     FROM payments p 
     LEFT JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.po_id = ?
     WHERE (pa.po_id = ? OR (p.po_id = ? AND pa.id IS NULL))`,
    [invoice.po_id, invoice.po_id, invoice.po_id]
  );

  // Posted debit notes on this bill and quantity already returned per PO item
  const [debitNotes] = await pool.query(
    `SELECT id, voucher_no, voucher_date, reason, total_amount, status
     FROM debit_notes WHERE vendor_invoice_id = ? OR (vendor_invoice_id IS NULL AND po_id = ?)
     ORDER BY voucher_date DESC, id DESC`,
    [id, invoice.po_id]
  );
  const [returnedRows] = await pool.query(
    `SELECT dni.po_item_id, SUM(dni.quantity) as returned_qty
     FROM debit_note_items dni
     JOIN debit_notes dn ON dni.debit_note_id = dn.id
     JOIN purchase_order_items poi ON poi.id = dni.po_item_id
     WHERE poi.purchase_order_id = ? AND dn.status = 'POSTED'
     GROUP BY dni.po_item_id`,
    [invoice.po_id]
  );
  const returnedMap = new Map(returnedRows.map(r => [r.po_item_id, parseFloat(r.returned_qty) || 0]));

  return {
    ...invoice,
    items: items.map(it => ({ ...it, returned_qty: returnedMap.get(it.id) || 0 })),
    payments,
    debit_notes: debitNotes
  };
};

const updateInvoiceDetails = async (id, data) => {
  const { vendor_invoice_no, invoice_date, invoice_amount, gst_amount, invoice_pdf_path } = data;

  await pool.query(
    `UPDATE vendor_invoices 
     SET vendor_invoice_no = ?,
         invoice_date = ?,
         invoice_amount = ?,
         gst_amount = ?,
         invoice_pdf_path = COALESCE(?, invoice_pdf_path),
         status = 'RECEIVED'
     WHERE id = ?`,
    [
      vendor_invoice_no,
      invoice_date ? new Date(invoice_date) : null,
      parseFloat(invoice_amount) || 0.00,
      parseFloat(gst_amount) || 0.00,
      invoice_pdf_path || null,
      id
    ]
  );

  return getVendorInvoiceById(id);
};

const verifyInvoice = async (id) => {
  await pool.query(
    `UPDATE vendor_invoices SET status = 'VERIFIED' WHERE id = ?`,
    [id]
  );
  return getVendorInvoiceById(id);
};

const revertVendorInvoiceFromAccounts = async (invoiceId) => {
  const [rows] = await pool.query('SELECT * FROM vendor_invoices WHERE id = ?', [invoiceId]);
  if (rows.length === 0) {
    throw new Error('Vendor Invoice not found');
  }

  const invoice = rows[0];
  const poId = invoice.po_id;

  // Decouple any payment allocations or direct payments linked to this vendor invoice
  await pool.query(
    'UPDATE payment_allocations SET invoice_id = NULL WHERE invoice_id = ?',
    [invoiceId]
  );
  await pool.query(
    'UPDATE payments SET invoice_id = NULL WHERE invoice_id = ?',
    [invoiceId]
  );

  // Remove the record from vendor_invoices (Accounts list)
  await pool.query('DELETE FROM vendor_invoices WHERE id = ?', [invoiceId]);

  // Revert the Purchase Order in Procurement without deleting the PO itself
  if (poId) {
    await pool.query(
      'UPDATE purchase_orders SET forwarded_to_accounts = 0 WHERE id = ?',
      [poId]
    );
  }

  return {
    success: true,
    message: `Vendor invoice ${invoice.vendor_invoice_no || invoice.po_number || invoiceId} removed from Accounts and reverted to Procurement`,
    data: { id: invoiceId, po_id: poId, po_number: invoice.po_number }
  };
};

module.exports = {
  getVendorInvoices,
  getVendorInvoiceById,
  updateInvoiceDetails,
  verifyInvoice,
  revertVendorInvoiceFromAccounts
};

