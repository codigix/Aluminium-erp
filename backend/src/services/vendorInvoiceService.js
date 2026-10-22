const pool = require('../config/db');

const getVendorInvoices = async (vendorId = null) => {
  let query = `SELECT 
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
      COALESCE(NULLIF(vi.vendor_invoice_no, ''), vi.po_number, CONCAT('BILL-', vi.id)) as display_invoice_no,
      vi.vendor_invoice_no,
      COALESCE(vi.invoice_date, vi.po_date, vi.created_at) as bill_date,
      vi.invoice_date,
      vi.invoice_amount,
      CASE WHEN CAST(vi.invoice_amount AS DECIMAL(14,2)) > 0 THEN vi.invoice_amount ELSE vi.po_amount END as bill_amount,
      vi.gst_amount,
      vi.invoice_pdf_path,
      vi.created_at,
      vi.updated_at,
      v.vendor_name,
      v.email as vendor_email,
      (
        COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments p ON pa.payment_id = p.id WHERE pa.po_id = vi.po_id AND p.status = 'CONFIRMED'), 0) +
        COALESCE((SELECT SUM(p.payment_amount) FROM payments p WHERE p.po_id = vi.po_id AND p.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)), 0)
      ) as already_paid,
      ((CASE WHEN CAST(vi.invoice_amount AS DECIMAL(14,2)) > 0 THEN vi.invoice_amount ELSE vi.po_amount END) - (
        COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments p ON pa.payment_id = p.id WHERE pa.po_id = vi.po_id AND p.status = 'CONFIRMED'), 0) +
        COALESCE((SELECT SUM(p.payment_amount) FROM payments p WHERE p.po_id = vi.po_id AND p.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)), 0)
      )) as outstanding,
      CASE 
        WHEN ((CASE WHEN CAST(vi.invoice_amount AS DECIMAL(14,2)) > 0 THEN vi.invoice_amount ELSE vi.po_amount END) - (
          COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments p ON pa.payment_id = p.id WHERE pa.po_id = vi.po_id AND p.status = 'CONFIRMED'), 0) +
          COALESCE((SELECT SUM(p.payment_amount) FROM payments p WHERE p.po_id = vi.po_id AND p.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)), 0)
        )) <= 0 THEN 'COMPLETED'
        ELSE vi.status 
      END as status
     FROM vendor_invoices vi
     JOIN vendors v ON vi.vendor_id = v.id`;

  const params = [];
  if (vendorId) {
    query += ` WHERE vi.vendor_id = ?`;
    params.push(vendorId);
  }
  query += ` ORDER BY vi.created_at DESC`;

  const [rows] = await pool.query(query, params);
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
      COALESCE(NULLIF(vi.vendor_invoice_no, ''), vi.po_number, CONCAT('BILL-', vi.id)) as display_invoice_no,
      vi.vendor_invoice_no,
      COALESCE(vi.invoice_date, vi.po_date, vi.created_at) as bill_date,
      vi.invoice_date,
      vi.invoice_amount,
      CASE WHEN CAST(vi.invoice_amount AS DECIMAL(14,2)) > 0 THEN vi.invoice_amount ELSE vi.po_amount END as bill_amount,
      vi.gst_amount,
      vi.invoice_pdf_path,
      vi.created_at,
      vi.updated_at,
      v.vendor_name,
      v.email as vendor_email,
      (
        COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments p ON pa.payment_id = p.id WHERE pa.po_id = vi.po_id AND p.status = 'CONFIRMED'), 0) +
        COALESCE((SELECT SUM(p.payment_amount) FROM payments p WHERE p.po_id = vi.po_id AND p.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)), 0)
      ) as already_paid,
      ((CASE WHEN CAST(vi.invoice_amount AS DECIMAL(14,2)) > 0 THEN vi.invoice_amount ELSE vi.po_amount END) - (
        COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments p ON pa.payment_id = p.id WHERE pa.po_id = vi.po_id AND p.status = 'CONFIRMED'), 0) +
        COALESCE((SELECT SUM(p.payment_amount) FROM payments p WHERE p.po_id = vi.po_id AND p.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)), 0)
      )) as outstanding,
      CASE 
        WHEN ((CASE WHEN CAST(vi.invoice_amount AS DECIMAL(14,2)) > 0 THEN vi.invoice_amount ELSE vi.po_amount END) - (
          COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments p ON pa.payment_id = p.id WHERE pa.po_id = vi.po_id AND p.status = 'CONFIRMED'), 0) +
          COALESCE((SELECT SUM(p.payment_amount) FROM payments p WHERE p.po_id = vi.po_id AND p.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id)), 0)
        )) <= 0 THEN 'COMPLETED'
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
    `SELECT p.*, COALESCE(pa.amount, p.payment_amount) as allocated_amount 
     FROM payments p 
     LEFT JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.po_id = ?
     WHERE (pa.po_id = ? OR (p.po_id = ? AND pa.id IS NULL))`,
    [invoice.po_id, invoice.po_id, invoice.po_id]
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

