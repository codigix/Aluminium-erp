const pool = require('../config/db');
const puppeteer = require('puppeteer');
const mustache = require('mustache');
const emailService = require('./emailService');

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

  if (!poId || !vendorId || !paymentAmount || !paymentDate || !paymentMode) {
    const error = new Error('Missing required payment fields');
    error.statusCode = 400;
    throw error;
  }

  const voucherNo = await generatePaymentVoucherNo();

  try {
    // Get PO Number for reference if invoiceId is null
    let referenceNo = invoiceId || '';
    if (!invoiceId && poId) {
      const [poRows] = await pool.query('SELECT po_number FROM purchase_orders WHERE id = ?', [poId]);
      if (poRows.length > 0) {
        referenceNo = poRows[0].po_number;
      }
    }

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
        invoiceId || null,
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
        `Payment for ${invoiceId ? 'Invoice ' + invoiceId : 'PO ' + referenceNo}: ${remarks || ''}`
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
        `Payment against ${invoiceId ? 'Invoice ' + invoiceId : 'PO ' + referenceNo}`,
        paymentDate
      ]
    );

    // Check if fully paid and update PO status
    if (poId) {
      const [poRows] = await pool.query('SELECT total_amount FROM purchase_orders WHERE id = ?', [poId]);
      const [paymentRows] = await pool.query('SELECT SUM(payment_amount) as total_paid FROM payments WHERE po_id = ? AND status = ?', [poId, 'CONFIRMED']);
      
      if (poRows.length > 0 && paymentRows[0].total_paid >= poRows[0].total_amount) {
        await pool.execute('UPDATE purchase_orders SET status = ? WHERE id = ?', ['PAID', poId]);
      }
    }

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

const generatePaymentVoucherPDF = async (paymentId) => {
  const payment = await getPaymentById(paymentId);
  
  const [vendorRows] = await pool.query(
    'SELECT * FROM companies WHERE id = ?',
    [payment.vendor_id]
  );
  const vendor = vendorRows[0];

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.6; margin: 40px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
        .company-info h1 { color: #059669; margin: 0; font-size: 24px; }
        .voucher-title { text-align: right; }
        .voucher-title h2 { margin: 0; color: #64748b; font-size: 18px; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .section-label { font-weight: bold; color: #64748b; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; }
        .payment-info { background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #e2e8f0; }
        .info-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .info-label { color: #64748b; font-size: 12px; }
        .info-value { font-weight: 600; color: #1e293b; font-size: 13px; }
        .amount-section { text-align: right; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; }
        .amount-label { font-size: 14px; color: #64748b; }
        .amount-value { font-size: 24px; font-weight: 800; color: #059669; }
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
        <div class="voucher-title">
          <h2>Payment Voucher</h2>
          <p><strong>Voucher No:</strong> {{payment_voucher_no}}<br>
          <strong>Date:</strong> {{formatted_date}}</p>
        </div>
      </div>

      <div class="details-grid">
        <div>
          <div class="section-label">Pay To</div>
          <p><strong>{{vendor_name}}</strong><br>
          {{location}}<br>
          {{email}}<br>
          {{phone}}</p>
        </div>
        <div style="text-align: right;">
          <div class="section-label">Reference</div>
          <p><strong>PO Number:</strong> {{po_number}}<br>
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
        <div class="amount-label">Total Amount Paid</div>
        <div class="amount-value">₹{{formatted_amount}}</div>
      </div>

      <div class="signature-area">
        <div class="sig-box">Receiver's Signature</div>
        <div class="sig-box">Authorized Signatory</div>
      </div>

      <div class="footer">
        <p>This is a computer-generated payment voucher.<br>
        SPTECHPIONEER PVT LTD | Confidential</p>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const viewData = {
    ...payment,
    vendor_name: vendor?.company_name || vendor?.vendor_name || 'N/A',
    email: vendor?.email || 'N/A',
    location: vendor?.address || vendor?.location || 'N/A',
    phone: vendor?.phone || 'N/A',
    formatted_date: formatDate(payment.payment_date),
    formatted_cheque_date: formatDate(payment.cheque_date),
    formatted_amount: parseFloat(payment.payment_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    remarks: payment.remarks || '—'
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

const sendPaymentVoucherEmail = async (paymentId, emailData = {}) => {
  const payment = await getPaymentById(paymentId);
  
  const [vendorRows] = await pool.query(
    'SELECT company_name, email FROM companies WHERE id = ?',
    [payment.vendor_id]
  );
  const vendor = vendorRows[0];

  const recipientEmail = emailData.to || vendor?.email;
  if (!recipientEmail) {
    throw new Error('Vendor email address not found');
  }

  const subject = emailData.subject || `Payment Voucher - ${payment.payment_voucher_no}`;
  const message = emailData.message || `Dear ${vendor?.company_name || 'Vendor'},

Please find attached the payment voucher ${payment.payment_voucher_no} for the payment made on ${new Date(payment.payment_date).toLocaleDateString()}.

Amount Paid: INR ${parseFloat(payment.payment_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}

Best Regards,
Accounts Department
SPTECHPIONEER PVT LTD`;

  const attachments = [];
  if (emailData.attachPDF !== false) {
    const pdfBuffer = await generatePaymentVoucherPDF(paymentId);
    attachments.push({
      filename: `Voucher-${payment.payment_voucher_no}.pdf`,
      content: pdfBuffer
    });
  }

  return await emailService.sendEmail(recipientEmail, subject, message, attachments);
};

module.exports = {
  processPayment,
  getPayments,
  getPaymentById,
  getVendorBalance,
  getPendingPayments,
  updatePaymentStatus,
  deletePayment,
  generatePaymentVoucherPDF,
  sendPaymentVoucherEmail
};
