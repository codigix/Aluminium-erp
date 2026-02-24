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
    salesOrderSource, // Added field
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

  const receiptNo = await generatePaymentReceiptNo();

  try {
    const [result] = await pool.execute(
      `INSERT INTO customer_payments (
        payment_receipt_no,
        invoice_id,
        sales_order_id,
        sales_order_source,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        receiptNo,
        invoiceId || null,
        salesOrderId || null,
        salesOrderSource || 'SALES_ORDER',
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

    // Check if fully paid and update status
    if (salesOrderId) {
      if (salesOrderSource === 'DIRECT_ORDER') {
        const [orders] = await pool.query('SELECT grand_total FROM orders WHERE id = ?', [salesOrderId]);
        const [payments] = await pool.query('SELECT SUM(payment_amount) as total_paid FROM customer_payments WHERE sales_order_id = ? AND sales_order_source = ? AND status = ?', [salesOrderId, 'DIRECT_ORDER', 'CONFIRMED']);
        if (orders.length > 0 && payments[0].total_paid >= orders[0].grand_total) {
          await pool.execute('UPDATE orders SET status = ? WHERE id = ?', ['Paid', salesOrderId]);
        }
      } else {
        // SALES_ORDER
        const [so] = await pool.query(`
          SELECT COALESCE(NULLIF(so.net_total, 0), NULLIF(cp.net_total, 0), (SELECT SUM(quantity * rate + tax_value) FROM sales_order_items WHERE sales_order_id = so.id), 0) as net_total 
          FROM sales_orders so 
          LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id 
          WHERE so.id = ?`, [salesOrderId]);
        const [payments] = await pool.query('SELECT SUM(payment_amount) as total_paid FROM customer_payments WHERE sales_order_id = ? AND sales_order_source = ? AND status = ?', [salesOrderId, 'SALES_ORDER', 'CONFIRMED']);
        if (so.length > 0 && so[0].net_total > 0 && payments[0].total_paid >= so[0].net_total) {
          await pool.execute('UPDATE sales_orders SET status = ? WHERE id = ?', ['PAID', salesOrderId]);
        }
      }
    }

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
        invoiceId ? `Payment received against invoice ${invoiceId}: ${remarks || ''}` : `Advance payment received: ${remarks || ''}`
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
        invoiceId ? `Payment received against invoice ${invoiceId}` : `Advance payment received`,
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
    `SELECT * FROM (
      -- From sales_orders (Design based)
      SELECT 
        so.id,
        CONVERT(COALESCE(so.so_number, cp_pos.po_number, CAST(so.id AS CHAR)) USING utf8mb4) as so_number,
        c.company_name,
        COALESCE(NULLIF(so.net_total, 0), NULLIF(cp_pos.net_total, 0), (SELECT SUM(quantity * rate + tax_value) FROM sales_order_items WHERE sales_order_id = so.id), 0) as total_amount,
        COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = so.id AND sales_order_source = 'SALES_ORDER' AND status = 'CONFIRMED'), 0) as paid_amount,
        (COALESCE(NULLIF(so.net_total, 0), NULLIF(cp_pos.net_total, 0), (SELECT SUM(quantity * rate + tax_value) FROM sales_order_items WHERE sales_order_id = so.id), 0) - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = so.id AND sales_order_source = 'SALES_ORDER' AND status = 'CONFIRMED'), 0)) as outstanding,
        CONVERT('SALES_ORDER' USING utf8mb4) as source,
        so.created_at
      FROM sales_orders so
      LEFT JOIN customer_pos cp_pos ON so.customer_po_id = cp_pos.id
      LEFT JOIN companies c ON so.company_id = c.id
      WHERE so.company_id = ? AND so.status NOT IN ('CLOSED', 'CANCELLED', 'PAID')

      UNION ALL

      -- From orders (Direct based)
      SELECT 
        o.id,
        CONVERT(o.order_no USING utf8mb4) as so_number,
        c.company_name,
        o.grand_total as total_amount,
        COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = o.id AND sales_order_source = 'DIRECT_ORDER' AND status = 'CONFIRMED'), 0) as paid_amount,
        (o.grand_total - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = o.id AND sales_order_source = 'DIRECT_ORDER' AND status = 'CONFIRMED'), 0)) as outstanding,
        CONVERT('DIRECT_ORDER' USING utf8mb4) as source,
        o.created_at
      FROM orders o
      LEFT JOIN companies c ON o.client_id = c.id
      WHERE o.client_id = ? AND o.status NOT IN ('Closed', 'Cancelled', 'Paid')
    ) combined
    WHERE outstanding > 0
    ORDER BY created_at DESC`,
    [customerId, customerId]
  );

  return invoices;
};

const getAllOutstandingInvoices = async () => {
  const [invoices] = await pool.query(
    `SELECT * FROM (
      -- From sales_orders (Design based)
      SELECT 
        so.id,
        CONVERT(COALESCE(so.so_number, cp_pos.po_number, CAST(so.id AS CHAR)) USING utf8mb4) as so_number,
        c.company_name,
        COALESCE(NULLIF(so.net_total, 0), NULLIF(cp_pos.net_total, 0), (SELECT SUM(quantity * rate + tax_value) FROM sales_order_items WHERE sales_order_id = so.id), 0) as total_amount,
        COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = so.id AND sales_order_source = 'SALES_ORDER' AND status = 'CONFIRMED'), 0) as paid_amount,
        (COALESCE(NULLIF(so.net_total, 0), NULLIF(cp_pos.net_total, 0), (SELECT SUM(quantity * rate + tax_value) FROM sales_order_items WHERE sales_order_id = so.id), 0) - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = so.id AND sales_order_source = 'SALES_ORDER' AND status = 'CONFIRMED'), 0)) as outstanding,
        CONVERT('SALES_ORDER' USING utf8mb4) as source,
        so.created_at
      FROM sales_orders so
      LEFT JOIN customer_pos cp_pos ON so.customer_po_id = cp_pos.id
      LEFT JOIN companies c ON so.company_id = c.id
      WHERE so.status NOT IN ('CLOSED', 'CANCELLED', 'PAID')

      UNION ALL

      -- From orders (Direct based)
      SELECT 
        o.id,
        CONVERT(o.order_no USING utf8mb4) as so_number,
        c.company_name,
        o.grand_total as total_amount,
        COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = o.id AND sales_order_source = 'DIRECT_ORDER' AND status = 'CONFIRMED'), 0) as paid_amount,
        (o.grand_total - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = o.id AND sales_order_source = 'DIRECT_ORDER' AND status = 'CONFIRMED'), 0)) as outstanding,
        CONVERT('DIRECT_ORDER' USING utf8mb4) as source,
        o.created_at
      FROM orders o
      LEFT JOIN companies c ON o.client_id = c.id
      WHERE o.status NOT IN ('Closed', 'Cancelled', 'Paid')
    ) combined
    WHERE outstanding > 0
    ORDER BY created_at DESC`
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
  getAllOutstandingInvoices, // Added
  updatePaymentStatus,
  deletePayment
};
