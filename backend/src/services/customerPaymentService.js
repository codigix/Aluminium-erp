const pool = require('../config/db');

const generatePaymentReceiptNo = async () => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) as count FROM customer_payments WHERE YEAR(created_at) = YEAR(NOW())'
  );
  const count = rows[0].count + 1;
  const year = new Date().getFullYear();
  return `PR-${year}-${String(count).padStart(5, '0')}`;
};

const recordPaymentReceived = async (payload) => {
  const {
    invoiceId,
    salesOrderId,
    customerId,
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

  if (!invoiceId && !salesOrderId) {
    const error = new Error('Either invoiceId or salesOrderId is required');
    error.statusCode = 400;
    throw error;
  }

  if (!customerId || !paymentAmount || !paymentDate || !paymentMode) {
    const error = new Error('Missing required payment fields');
    error.statusCode = 400;
    throw error;
  }

  const receiptNo = await generatePaymentReceiptNo();

  try {
    const [result] = await pool.execute(
      `INSERT INTO customer_payments (
        payment_receipt_no,
        invoice_id,
        sales_order_id,
        customer_id,
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
        receiptNo,
        invoiceId || null,
        salesOrderId || null,
        customerId,
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
      `INSERT INTO payment_receipts (
        receipt_no,
        receipt_date,
        payment_id,
        customer_id,
        amount,
        description
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        receiptNo,
        paymentDate,
        paymentId,
        customerId,
        parseFloat(paymentAmount),
        `Payment received from customer ${customerId}: ${remarks || ''}`
      ]
    );

    await pool.execute(
      `INSERT INTO customer_ledger (
        customer_id,
        reference_doc_id,
        reference_doc_type,
        transaction_type,
        amount,
        description,
        ledger_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        paymentId,
        'PAYMENT',
        'DEBIT',
        parseFloat(paymentAmount),
        `Payment received from customer`,
        paymentDate
      ]
    );

    return {
      id: paymentId,
      paymentReceiptNo: receiptNo,
      status: 'success',
      message: 'Payment received and recorded successfully'
    };
  } catch (error) {
    console.error('Error recording payment received:', error);
    throw error;
  }
};

const getPaymentsReceived = async (filters = {}) => {
  let query = `
    SELECT 
      cp.*,
      so.so_number,
      c.company_name as customer_name,
      ba.bank_name,
      ba.account_number
    FROM customer_payments cp
    LEFT JOIN sales_orders so ON cp.sales_order_id = so.id
    LEFT JOIN companies c ON cp.customer_id = c.id
    LEFT JOIN bank_accounts ba ON cp.bank_account_id = ba.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.customerId) {
    query += ' AND cp.customer_id = ?';
    params.push(filters.customerId);
  }

  if (filters.status) {
    query += ' AND cp.status = ?';
    params.push(filters.status);
  }

  if (filters.paymentMode) {
    query += ' AND cp.payment_mode = ?';
    params.push(filters.paymentMode);
  }

  if (filters.startDate && filters.endDate) {
    query += ' AND cp.payment_date BETWEEN ? AND ?';
    params.push(filters.startDate, filters.endDate);
  }

  query += ' ORDER BY cp.created_at DESC';

  const [payments] = await pool.query(query, params);
  return payments;
};

const getPaymentReceivedById = async (paymentId) => {
  const [rows] = await pool.query(
    `SELECT 
      cp.*,
      so.so_number,
      c.company_name as customer_name,
      ba.bank_name,
      ba.account_number
    FROM customer_payments cp
    LEFT JOIN sales_orders so ON cp.sales_order_id = so.id
    LEFT JOIN companies c ON cp.customer_id = c.id
    LEFT JOIN bank_accounts ba ON cp.bank_account_id = ba.id
    WHERE cp.id = ?`,
    [paymentId]
  );

  if (!rows.length) {
    const error = new Error('Payment not found');
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
};

const getCustomerBalance = async (customerId) => {
  const [rows] = await pool.query(
    `SELECT 
      SUM(CASE WHEN transaction_type = 'DEBIT' THEN amount ELSE -amount END) as outstanding
    FROM customer_ledger
    WHERE customer_id = ?`,
    [customerId]
  );

  return {
    customerId,
    outstanding: rows[0]?.outstanding || 0
  };
};

const getOutstandingInvoices = async (customerId) => {
  const [invoices] = await pool.query(
    `SELECT 
      so.id,
      so.so_number,
      c.company_name,
      so.net_total,
      COALESCE(SUM(cp.payment_amount), 0) as paid_amount,
      (so.net_total - COALESCE(SUM(cp.payment_amount), 0)) as outstanding
    FROM sales_orders so
    LEFT JOIN companies c ON so.company_id = c.id
    LEFT JOIN customer_payments cp ON so.id = cp.sales_order_id
    WHERE so.company_id = ? AND so.status = 'COMPLETED'
    GROUP BY so.id
    HAVING outstanding > 0
    ORDER BY so.created_at DESC`,
    [customerId]
  );

  return invoices;
};

const updatePaymentStatus = async (paymentId, status) => {
  const validStatuses = ['PENDING', 'CONFIRMED', 'FAILED'];
  
  if (!validStatuses.includes(status)) {
    const error = new Error('Invalid payment status');
    error.statusCode = 400;
    throw error;
  }

  await pool.execute(
    'UPDATE customer_payments SET status = ?, updated_at = NOW() WHERE id = ?',
    [status, paymentId]
  );

  return { id: paymentId, status };
};

const deletePayment = async (paymentId) => {
  await pool.execute('DELETE FROM customer_payments WHERE id = ?', [paymentId]);
  return { id: paymentId, message: 'Payment deleted successfully' };
};

module.exports = {
  recordPaymentReceived,
  getPaymentsReceived,
  getPaymentReceivedById,
  getCustomerBalance,
  getOutstandingInvoices,
  updatePaymentStatus,
  deletePayment
};
