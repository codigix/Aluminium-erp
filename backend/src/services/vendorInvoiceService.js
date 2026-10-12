const pool = require('../config/db');

const getVendorInvoices = async () => {
  const [rows] = await pool.query(
    `SELECT 
      vi.id,
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
      vi.vendor_invoice_no,
      vi.invoice_date,
      vi.invoice_amount,
      vi.gst_amount,
      vi.invoice_pdf_path,
      vi.created_at,
      vi.updated_at,
      v.vendor_name,
      v.email as vendor_email,
      COALESCE((SELECT SUM(payment_amount) FROM payments WHERE po_id = vi.po_id AND status = 'CONFIRMED'), 0) as already_paid,
      (vi.po_amount - COALESCE((SELECT SUM(payment_amount) FROM payments WHERE po_id = vi.po_id AND status = 'CONFIRMED'), 0)) as outstanding,
      CASE 
        WHEN (vi.po_amount - COALESCE((SELECT SUM(payment_amount) FROM payments WHERE po_id = vi.po_id AND status = 'CONFIRMED'), 0)) <= 0 THEN 'COMPLETED'
        ELSE vi.status 
      END as status
     FROM vendor_invoices vi
     JOIN vendors v ON vi.vendor_id = v.id
     ORDER BY vi.created_at DESC`
  );
  return rows;
};

const getVendorInvoiceById = async (id) => {
  const [invoices] = await pool.query(
    `SELECT 
      vi.id,
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
      vi.vendor_invoice_no,
      vi.invoice_date,
      vi.invoice_amount,
      vi.gst_amount,
      vi.invoice_pdf_path,
      vi.created_at,
      vi.updated_at,
      v.vendor_name,
      v.email as vendor_email,
      COALESCE((SELECT SUM(payment_amount) FROM payments WHERE po_id = vi.po_id AND status = 'CONFIRMED'), 0) as already_paid,
      (vi.po_amount - COALESCE((SELECT SUM(payment_amount) FROM payments WHERE po_id = vi.po_id AND status = 'CONFIRMED'), 0)) as outstanding,
      CASE 
        WHEN (vi.po_amount - COALESCE((SELECT SUM(payment_amount) FROM payments WHERE po_id = vi.po_id AND status = 'CONFIRMED'), 0)) <= 0 THEN 'COMPLETED'
        ELSE vi.status 
      END as status
     FROM vendor_invoices vi
     JOIN vendors v ON vi.vendor_id = v.id
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
    `SELECT * FROM payments WHERE po_id = ?`,
    [invoice.po_id]
  );

  return {
    ...invoice,
    items,
    payments
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

// 3-way match: the vendor's bill must agree with what was ordered (PO rate)
// and received (GRN quantity), captured in po_amount when forwarded to Accounts.
// A variance above tolerance needs an explicit override with a reason.
const VARIANCE_TOLERANCE_PERCENT = 1;
const VARIANCE_TOLERANCE_AMOUNT = 10;

const verifyInvoice = async (id, options = {}) => {
  const { override = false, reason = '' } = options;
  const [rows] = await pool.query('SELECT id, status, vendor_invoice_no, invoice_amount, po_amount FROM vendor_invoices WHERE id = ?', [id]);
  if (!rows.length) {
    const error = new Error('Vendor invoice not found');
    error.statusCode = 404;
    throw error;
  }
  const invoice = rows[0];
  const status = String(invoice.status || '').toUpperCase();

  if (status === 'VERIFIED' || status === 'COMPLETED') return getVendorInvoiceById(id);
  if (!invoice.vendor_invoice_no || !(parseFloat(invoice.invoice_amount) > 0)) {
    const error = new Error('Enter the vendor invoice number and amount before verifying');
    error.statusCode = 400;
    throw error;
  }

  const billed = parseFloat(invoice.invoice_amount) || 0;
  const expected = parseFloat(invoice.po_amount) || 0;
  const variance = billed - expected;
  const allowed = Math.max(VARIANCE_TOLERANCE_AMOUNT, expected * VARIANCE_TOLERANCE_PERCENT / 100);

  if (expected > 0 && variance > allowed) {
    if (!override || !String(reason).trim()) {
      const error = new Error(
        `Invoice amount ${billed.toFixed(2)} is ${variance.toFixed(2)} more than the received value ${expected.toFixed(2)} (PO rate x GRN qty). Provide a reason to approve the difference.`
      );
      error.statusCode = 409;
      error.code = 'INVOICE_VARIANCE';
      error.details = { billed, expected, variance };
      throw error;
    }
    console.log(`[VendorInvoice] ${id} verified with variance ${variance.toFixed(2)}: ${reason}`);
  }

  await pool.query(
    `UPDATE vendor_invoices SET status = 'VERIFIED' WHERE id = ?`,
    [id]
  );
  return getVendorInvoiceById(id);
};

module.exports = {
  getVendorInvoices,
  getVendorInvoiceById,
  updateInvoiceDetails,
  verifyInvoice
};
