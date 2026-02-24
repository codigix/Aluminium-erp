const pool = require('../config/db');
const puppeteer = require('puppeteer');
const mustache = require('mustache');
const emailService = require('./emailService');

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
  // Debug to check columns
  const [columns] = await pool.query('SHOW COLUMNS FROM sales_orders');
  console.log('[DEBUG] sales_orders columns:', columns.map(c => c.Field));

  const [invoices] = await pool.query(
    `SELECT * FROM (
      -- From sales_orders (Design based)
      SELECT 
        so.id,
        so.company_id as company_id,
        CONVERT(COALESCE(so.so_number, cp_pos.po_number, CAST(so.id AS CHAR)) USING utf8mb4) as so_number,
        c.company_name as company_name,
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
        o.client_id as company_id,
        CONVERT(o.order_no USING utf8mb4) as so_number,
        c.company_name as company_name,
        o.grand_total as total_amount,
        COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = o.id AND sales_order_source = 'DIRECT_ORDER' AND status = 'CONFIRMED'), 0) as paid_amount,
        (o.grand_total - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = o.id AND sales_order_source = 'DIRECT_ORDER' AND status = 'CONFIRMED'), 0)) as outstanding,
        CONVERT('DIRECT_ORDER' USING utf8mb4) as source,
        o.created_at
      FROM orders o
      LEFT JOIN companies c ON o.client_id = c.id
      WHERE o.client_id = ? AND o.status NOT IN ('Closed', 'Cancelled', 'Paid', 'PAID', 'CANCELLED', 'CLOSED')
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
        so.company_id as company_id,
        CONVERT(COALESCE(so.so_number, cp_pos.po_number, CAST(so.id AS CHAR)) USING utf8mb4) as so_number,
        c.company_name as company_name,
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
        o.client_id as company_id,
        CONVERT(o.order_no USING utf8mb4) as so_number,
        c.company_name as company_name,
        o.grand_total as total_amount,
        COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = o.id AND sales_order_source = 'DIRECT_ORDER' AND status = 'CONFIRMED'), 0) as paid_amount,
        (o.grand_total - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = o.id AND sales_order_source = 'DIRECT_ORDER' AND status = 'CONFIRMED'), 0)) as outstanding,
        CONVERT('DIRECT_ORDER' USING utf8mb4) as source,
        o.created_at
      FROM orders o
      LEFT JOIN companies c ON o.client_id = c.id
      WHERE o.status NOT IN ('Closed', 'Cancelled', 'Paid', 'PAID', 'CANCELLED', 'CLOSED')
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

const generateCustomerPaymentReceiptPDF = async (paymentId) => {
  const payment = await getPaymentReceivedById(paymentId);
  
  const [customerRows] = await pool.query(
    'SELECT * FROM companies WHERE id = ?',
    [payment.customer_id]
  );
  const customer = customerRows[0];

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.6; margin: 40px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
        .company-info h1 { color: #1d4ed8; margin: 0; font-size: 24px; }
        .receipt-title { text-align: right; }
        .receipt-title h2 { margin: 0; color: #64748b; font-size: 18px; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .section-label { font-weight: bold; color: #64748b; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; }
        .payment-info { background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #e2e8f0; }
        .info-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .info-label { color: #64748b; font-size: 12px; }
        .info-value { font-weight: 600; color: #1e293b; font-size: 13px; }
        .amount-section { text-align: right; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; }
        .amount-label { font-size: 14px; color: #64748b; }
        .amount-value { font-size: 24px; font-weight: 800; color: #1d4ed8; }
        .footer { margin-top: 60px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        .signature-area { display: flex; justify-content: space-between; margin-top: 80px; }
        .sig-box { border-top: 1px solid #cbd5e1; width: 200px; text-align: center; padding-top: 8px; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          <h1>SPTECHPIONEER PVT LTD</h1>
          <p>Industrial Area, Sector 5<br>Pune, Maharashtra - 411026</p>
        </div>
        <div class="receipt-title">
          <h2>Payment Receipt</h2>
          <p><strong>Receipt No:</strong> {{payment_receipt_no}}<br>
          <strong>Date:</strong> {{formatted_date}}</p>
        </div>
      </div>

      <div class="details-grid">
        <div>
          <div class="section-label">Received From</div>
          <p><strong>{{customer_name}}</strong><br>
          {{location}}<br>
          {{email}}<br>
          {{phone}}</p>
        </div>
        <div style="text-align: right;">
          <div class="section-label">Reference</div>
          <p><strong>Sales Order:</strong> {{so_number}}<br>
          <strong>Status:</strong> {{status}}</p>
        </div>
      </div>

      <div class="payment-info">
        <div class="section-label" style="margin-bottom: 15px;">Payment Details</div>
        
        <div class="info-row">
          <span class="info-label">Payment Mode</span>
          <span class="info-value">{{payment_mode}}</span>
        </div>

        {{#cheque_number}}
        <div class="info-row">
          <span class="info-label">Cheque Number</span>
          <span class="info-value">{{cheque_number}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Bank Name</span>
          <span class="info-value">{{cheque_bank_name}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Cheque Date</span>
          <span class="info-value">{{formatted_cheque_date}}</span>
        </div>
        {{/cheque_number}}

        {{#transaction_ref_no}}
        <div class="info-row">
          <span class="info-label">Transaction Ref</span>
          <span class="info-value">{{transaction_ref_no}}</span>
        </div>
        {{/transaction_ref_no}}

        {{#upi_transaction_id}}
        <div class="info-row">
          <span class="info-label">UPI ID / App</span>
          <span class="info-value">{{upi_transaction_id}} ({{upi_app}})</span>
        </div>
        {{/upi_transaction_id}}

        <div class="info-row">
          <span class="info-label">Remarks</span>
          <span class="info-value">{{remarks}}</span>
        </div>
      </div>

      <div class="amount-section">
        <div class="amount-label">Total Amount Received</div>
        <div class="amount-value">₹{{formatted_amount}}</div>
      </div>

      <div class="signature-area">
        <div class="sig-box">Customer's Signature</div>
        <div class="sig-box">Authorized Signatory</div>
      </div>

      <div class="footer">
        <p>This is a computer-generated payment receipt.<br>
        SPTECHPIONEER PVT LTD | Confidential</p>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const viewData = {
    ...payment,
    customer_name: customer?.company_name || customer?.vendor_name || 'N/A',
    email: customer?.email || 'N/A',
    location: customer?.address || customer?.location || 'N/A',
    phone: customer?.phone || 'N/A',
    formatted_date: formatDate(payment.payment_date),
    formatted_cheque_date: formatDate(payment.cheque_date),
    formatted_amount: parseFloat(payment.payment_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    remarks: payment.remarks || '—',
    so_number: payment.so_number || 'Advance Payment'
  };

  const html = mustache.render(htmlTemplate, viewData);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ 
    format: 'A4', 
    printBackground: true,
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
  });
  await browser.close();

  return pdf;
};

const sendCustomerPaymentReceiptEmail = async (paymentId, emailData = {}) => {
  const payment = await getPaymentReceivedById(paymentId);
  
  const [customerRows] = await pool.query(
    'SELECT company_name, email FROM companies WHERE id = ?',
    [payment.customer_id]
  );
  const customer = customerRows[0];

  const recipientEmail = emailData.to || customer?.email;
  if (!recipientEmail) {
    throw new Error('Customer email address not found');
  }

  const subject = emailData.subject || `Payment Receipt - ${payment.payment_receipt_no}`;
  const message = emailData.message || `Dear ${customer?.company_name || 'Customer'},

Thank you for your payment. Please find attached the payment receipt ${payment.payment_receipt_no} for the payment received on ${new Date(payment.payment_date).toLocaleDateString()}.

Amount Received: INR ${parseFloat(payment.payment_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}

Best Regards,
Accounts Department
SPTECHPIONEER PVT LTD`;

  const attachments = [];
  if (emailData.attachPDF !== false) {
    const pdfBuffer = await generateCustomerPaymentReceiptPDF(paymentId);
    attachments.push({
      filename: `Receipt-${payment.payment_receipt_no}.pdf`,
      content: pdfBuffer
    });
  }

  return await emailService.sendEmail(recipientEmail, subject, message, attachments);
};

module.exports = {
  recordPaymentReceived,
  getPaymentsReceived,
  getPaymentReceivedById,
  getCustomerBalance,
  getOutstandingInvoices,
  getAllOutstandingInvoices,
  updatePaymentStatus,
  deletePayment,
  generateCustomerPaymentReceiptPDF,
  sendCustomerPaymentReceiptEmail
};
