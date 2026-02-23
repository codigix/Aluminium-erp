const pool = require('../config/db');

const generatePaymentVoucherNo = async () => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) as count FROM payments WHERE YEAR(created_at) = YEAR(NOW())'
  );
  const count = rows[0].count + 1;
  const year = new Date().getFullYear();
  return `PV-${year}-${String(count).padStart(5, '0')}`;
};

const processPayment = async (payload) => {
  const {
    invoiceId,
    poId,
    vendorId,
    paymentAmount,
    paymentDate,
    paymentMode,
    transactionRefNo,
    remarks,
    bankAccount,
    upiApp,
    upiTransactionId,
    chequeNumber,
    bankName,
    chequeDate,
    cardType,
    last4Digits,
    authorizationCode,
    createdBy
  } = payload;

  if (!invoiceId || !poId || !vendorId || !paymentAmount || !paymentDate || !paymentMode) {
    const error = new Error('Missing required payment fields');
    error.statusCode = 400;
    throw error;
  }

  const voucherNo = await generatePaymentVoucherNo();

  try {
    const [result] = await pool.execute(
      `INSERT INTO payments (
        payment_voucher_no,
        invoice_id,
        po_id,
        vendor_id,
        payment_amount,
        payment_date,
        payment_mode,
        transaction_ref_no,
        bank_account_id,
        remarks,
        upi_app,
        upi_transaction_id,
        cheque_number,
        cheque_bank_name,
        cheque_date,
        card_type,
        card_last_4_digits,
        authorization_code,
        status,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        voucherNo,
        invoiceId,
        poId,
        vendorId,
        parseFloat(paymentAmount),
        paymentDate,
        paymentMode,
        transactionRefNo || null,
        bankAccount || null,
        remarks || null,
        upiApp || null,
        upiTransactionId || null,
        chequeNumber || null,
        bankName || null,
        chequeDate || null,
        cardType || null,
        last4Digits || null,
        authorizationCode || null,
        'CONFIRMED',
        createdBy || null
      ]
    );

    const paymentId = result.insertId;

    await pool.execute(
      `INSERT INTO payment_vouchers (
        voucher_no,
        voucher_date,
        payment_id,
        vendor_id,
        amount,
        description
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        voucherNo,
        paymentDate,
        paymentId,
        vendorId,
        parseFloat(paymentAmount),
        `Payment for Invoice ${invoiceId}: ${remarks || ''}`
      ]
    );

    await pool.execute(
      `INSERT INTO vendor_ledger (
        vendor_id,
        reference_doc_id,
        reference_doc_type,
        transaction_type,
        amount,
        description,
        ledger_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        vendorId,
        paymentId,
        'PAYMENT',
        'CREDIT',
        parseFloat(paymentAmount),
        `Payment against Invoice ${invoiceId}`,
        paymentDate
      ]
    );

    return {
      id: paymentId,
      paymentVoucherNo: voucherNo,
      status: 'success',
      message: 'Payment processed successfully'
    };
  } catch (error) {
    console.error('Error processing payment:', error);
    throw error;
  }
};

const getPayments = async (filters = {}) => {
  let query = `
    SELECT 
      p.*,
      po.po_number,
      c.company_name as vendor_name,
      ba.bank_name,
      ba.account_number
    FROM payments p
    LEFT JOIN purchase_orders po ON p.po_id = po.id
    LEFT JOIN companies c ON p.vendor_id = c.id
    LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.vendorId) {
    query += ' AND p.vendor_id = ?';
    params.push(filters.vendorId);
  }

  if (filters.status) {
    query += ' AND p.status = ?';
    params.push(filters.status);
  }

  if (filters.paymentMode) {
    query += ' AND p.payment_mode = ?';
    params.push(filters.paymentMode);
  }

  if (filters.startDate && filters.endDate) {
    query += ' AND p.payment_date BETWEEN ? AND ?';
    params.push(filters.startDate, filters.endDate);
  }

  query += ' ORDER BY p.created_at DESC';

  const [payments] = await pool.query(query, params);
  return payments;
};

const getPaymentById = async (paymentId) => {
  const [rows] = await pool.query(
    `SELECT 
      p.*,
      po.po_number,
      c.company_name as vendor_name,
      ba.bank_name,
      ba.account_number
    FROM payments p
    LEFT JOIN purchase_orders po ON p.po_id = po.id
    LEFT JOIN companies c ON p.vendor_id = c.id
    LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
    WHERE p.id = ?`,
    [paymentId]
  );

  if (!rows.length) {
    const error = new Error('Payment not found');
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
};

const getVendorBalance = async (vendorId) => {
  const [rows] = await pool.query(
    `SELECT 
      SUM(CASE WHEN transaction_type = 'DEBIT' THEN amount ELSE -amount END) as outstanding
    FROM vendor_ledger
    WHERE vendor_id = ?`,
    [vendorId]
  );

  return {
    vendorId,
    outstanding: rows[0]?.outstanding || 0
  };
};

const getPendingPayments = async () => {
  const [payments] = await pool.query(
    `SELECT 
      p.*,
      po.po_number,
      po.total_amount,
      po.created_at,
      c.company_name as vendor_name,
      c.id as vendor_id,
      COALESCE(SUM(payments.payment_amount), 0) as already_paid,
      (po.total_amount - COALESCE(SUM(payments.payment_amount), 0)) as outstanding
    FROM purchase_orders p
    LEFT JOIN payments ON p.id = payments.po_id
    LEFT JOIN companies c ON p.vendor_id = c.id
    WHERE p.status IN ('SENT', 'RECEIVED')
    GROUP BY p.id
    HAVING outstanding > 0
    ORDER BY p.created_at DESC`
  );

  return payments;
};

const updatePaymentStatus = async (paymentId, status) => {
  const validStatuses = ['PENDING', 'CONFIRMED', 'FAILED'];
  
  if (!validStatuses.includes(status)) {
    const error = new Error('Invalid payment status');
    error.statusCode = 400;
    throw error;
  }

  await pool.execute(
    'UPDATE payments SET status = ?, updated_at = NOW() WHERE id = ?',
    [status, paymentId]
  );

  return { id: paymentId, status };
};

const deletePayment = async (paymentId) => {
  await pool.execute('DELETE FROM payments WHERE id = ?', [paymentId]);
  return { id: paymentId, message: 'Payment deleted successfully' };
};

module.exports = {
  processPayment,
  getPayments,
  getPaymentById,
  getVendorBalance,
  getPendingPayments,
  updatePaymentStatus,
  deletePayment
};
