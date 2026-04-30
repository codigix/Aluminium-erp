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
    jobCardQualityLogId,
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

  if ((!poId && !jobCardQualityLogId) || !vendorId || !paymentAmount || !paymentDate || !paymentMode) {
    const error = new Error('Missing required payment fields');
    error.statusCode = 400;
    throw error;
  }

  const voucherNo = await generatePaymentVoucherNo();

  try {
    // Get Reference Number
    let referenceNo = invoiceId || '';
    if (!invoiceId) {
      if (poId) {
        const [poRows] = await pool.query('SELECT po_number FROM purchase_orders WHERE id = ?', [poId]);
        if (poRows.length > 0) {
          referenceNo = poRows[0].po_number;
        }
      } else if (jobCardQualityLogId) {
        const [qlRows] = await pool.query(`
          SELECT jc.job_card_no 
          FROM job_card_quality_logs ql
          JOIN job_cards jc ON ql.job_card_id = jc.id
          WHERE ql.id = ?
        `, [jobCardQualityLogId]);
        if (qlRows.length > 0) {
          referenceNo = qlRows[0].job_card_no;
        }
      }
    }

    const isNumericId = !isNaN(parseInt(bankAccount)) && isFinite(bankAccount);
    const bankAccountId = isNumericId ? parseInt(bankAccount) : null;
    const manualBankAccount = isNumericId ? null : bankAccount;

    const [result] = await pool.execute(
      `INSERT INTO payments (
        payment_voucher_no,
        invoice_id,
        po_id,
        job_card_quality_log_id,
        vendor_id,
        payment_amount,
        payment_date,
        payment_mode,
        transaction_ref_no,
        bank_account_id,
        manual_bank_account,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        voucherNo,
        invoiceId || null,
        poId || null,
        jobCardQualityLogId || null,
        vendorId,
        parseFloat(paymentAmount),
        paymentDate,
        paymentMode,
        transactionRefNo || null,
        bankAccountId,
        manualBankAccount || null,
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
        `Payment for ${invoiceId ? 'Invoice ' + invoiceId : (poId ? 'PO ' + referenceNo : 'Job Card ' + referenceNo)}: ${remarks || ''}`
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
        `Payment against ${invoiceId ? 'Invoice ' + invoiceId : (poId ? 'PO ' + referenceNo : 'Job Card ' + referenceNo)}`,
        paymentDate
      ]
    );

    // Update status if fully paid
    if (poId) {
      const [poRows] = await pool.query('SELECT total_amount FROM purchase_orders WHERE id = ?', [poId]);
      const [paymentRows] = await pool.query('SELECT SUM(payment_amount) as total_paid FROM payments WHERE po_id = ? AND status = ?', [poId, 'CONFIRMED']);
      
      if (poRows.length > 0 && paymentRows[0].total_paid >= poRows[0].total_amount) {
        await pool.execute('UPDATE purchase_orders SET status = ? WHERE id = ?', ['PAID', poId]);
      }
    } else if (jobCardQualityLogId) {
      const [qlRows] = await pool.query('SELECT grand_total FROM job_card_quality_logs WHERE id = ?', [jobCardQualityLogId]);
      const [paymentRows] = await pool.query('SELECT SUM(payment_amount) as total_paid FROM payments WHERE job_card_quality_log_id = ? AND status = ?', [jobCardQualityLogId, 'CONFIRMED']);
      
      if (qlRows.length > 0 && paymentRows[0].total_paid >= qlRows[0].grand_total) {
        await pool.execute('UPDATE job_card_quality_logs SET status = ? WHERE id = ?', ['PAID', jobCardQualityLogId]);
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
      COALESCE(po.po_number, jc.job_card_no) as po_number,
      v.vendor_name,
      v.email as vendor_email,
      COALESCE(ba.bank_name, p.manual_bank_account) as bank_name,
      ba.account_number
    FROM payments p
    LEFT JOIN purchase_orders po ON p.po_id = po.id
    LEFT JOIN job_card_quality_logs ql ON p.job_card_quality_log_id = ql.id
    LEFT JOIN job_cards jc ON ql.job_card_id = jc.id
    LEFT JOIN vendors v ON p.vendor_id = v.id
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
      COALESCE(po.po_number, jc.job_card_no) as po_number,
      v.vendor_name,
      COALESCE(ba.bank_name, p.manual_bank_account) as bank_name,
      ba.account_number
    FROM payments p
    LEFT JOIN purchase_orders po ON p.po_id = po.id
    LEFT JOIN job_card_quality_logs ql ON p.job_card_quality_log_id = ql.id
    LEFT JOIN job_cards jc ON ql.job_card_id = jc.id
    LEFT JOIN vendors v ON p.vendor_id = v.id
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
  const [poPayments] = await pool.query(
    `SELECT 
      po.id,
      po.po_number,
      po.total_amount,
      po.created_at,
      v.vendor_name,
      v.id as vendor_id,
      'PURCHASE_ORDER' as type,
      COALESCE((SELECT SUM(payment_amount) FROM payments WHERE po_id = po.id AND status = 'CONFIRMED'), 0) as already_paid,
      (po.total_amount - COALESCE((SELECT SUM(payment_amount) FROM payments WHERE po_id = po.id AND status = 'CONFIRMED'), 0)) as outstanding
    FROM purchase_orders po
    LEFT JOIN vendors v ON po.vendor_id = v.id
    WHERE po.status IN ('SENT', 'RECEIVED', 'PARTIALLY_RECEIVED', 'APPROVED', 'FULFILLED')
    HAVING outstanding > 0`
  );

  const [subconPayments] = await pool.query(
    `SELECT 
      ql.id,
      jc.job_card_no as po_number,
      ql.grand_total as total_amount,
      ql.check_date as created_at,
      v.vendor_name,
      v.id as vendor_id,
      'SUBCONTRACTING' as type,
      COALESCE((SELECT SUM(payment_amount) FROM payments WHERE job_card_quality_log_id = ql.id AND status = 'CONFIRMED'), 0) as already_paid,
      (ql.grand_total - COALESCE((SELECT SUM(payment_amount) FROM payments WHERE job_card_quality_log_id = ql.id AND status = 'CONFIRMED'), 0)) as outstanding
    FROM job_card_quality_logs ql
    JOIN job_cards jc ON ql.job_card_id = jc.id
    JOIN outward_challans oc ON jc.id = oc.job_card_id
    JOIN vendors v ON oc.vendor_id = v.id
    WHERE ql.status IN ('PROCESSING', 'APPROVED') AND ql.grand_total > 0
    HAVING outstanding > 0`
  );

  const allPayments = [...poPayments, ...subconPayments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return allPayments;
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
    'SELECT * FROM vendors WHERE id = ?',
    [payment.vendor_id]
  );
  const vendor = vendorRows[0];

  let poDetails = null;
  if (payment.po_id) {
    const [poRows] = await pool.query(
      'SELECT * FROM purchase_orders WHERE id = ?',
      [payment.po_id]
    );
    if (poRows.length > 0) {
      poDetails = poRows[0];
      const [itemRows] = await pool.query(
        'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?',
        [payment.po_id]
      );
      poDetails.items = itemRows.map(item => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.unit_rate || item.rate) || 0;
        const amount = qty * rate;
        return {
          ...item,
          quantity: qty,
          rate: rate,
          amount: amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        };
      });

      // Calculate totals for items
      const subtotal = itemRows.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_rate || item.rate) || 0)), 0);
      const cgst = itemRows.reduce((sum, item) => sum + (parseFloat(item.cgst_amount) || ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_rate || item.rate) || 0) * 0.09)), 0);
      const sgst = itemRows.reduce((sum, item) => sum + (parseFloat(item.sgst_amount) || ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_rate || item.rate) || 0) * 0.09)), 0);
      
      poDetails.subtotal = subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      poDetails.cgst = cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      poDetails.sgst = sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      poDetails.grand_total = (subtotal + cgst + sgst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.5; margin: 0; padding: 40px; background-color: white; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
        .company-info h1 { color: #1e3a8a; margin: 0 0 5px 0; font-size: 24px; font-weight: 800; }
        .company-info p { margin: 2px 0; color: #64748b; font-size: 13px; }
        .voucher-title { text-align: right; }
        .voucher-title h2 { margin: 0; color: #3b82f6; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
        .voucher-title p { margin: 5px 0 0 0; font-size: 13px; color: #475569; }
        
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
        .section { background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .section-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; }
        
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
        .info-label { color: #64748b; }
        .info-value { font-weight: 600; color: #1e293b; }
        
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
        .items-table th { background: #f1f5f9; color: #475569; text-align: left; padding: 12px 10px; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        .items-table td { padding: 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
        .items-table .text-right { text-align: right; }
        .items-table .text-center { text-align: center; }
        
        .totals-section { margin-left: auto; width: 250px; margin-bottom: 40px; }
        .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; }
        .total-row.grand-total { border-top: 2px solid #3b82f6; margin-top: 10px; padding-top: 10px; font-weight: 800; font-size: 15px; color: #1e3a8a; }
        
        .payment-summary { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .payment-summary h3 { margin: 0 0 15px 0; font-size: 14px; color: #1e40af; border-bottom: 1px solid #bfdbfe; padding-bottom: 10px; }
        
        .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="company-info">
            <h1>SPTECHPIONEER PVT LTD</h1>
            <p>Industrial Area, Sector 5</p>
            <p>Pune, Maharashtra - 411026</p>
            <p>GSTIN: 27AASCS1234A1Z1</p>
          </div>
          <div class="voucher-title">
            <h2>Payment Voucher</h2>
            <p><strong>No:</strong> {{payment_voucher_no}}</p>
            <p><strong>Date:</strong> {{formatted_date}}</p>
          </div>
        </div>

        <div class="grid">
          <div class="section">
            <div class="section-title">Vendor / Beneficiary</div>
            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b;">{{vendor_name}}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #64748b;">{{location}}</p>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Email: {{email}}</p>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Phone: {{phone}}</p>
          </div>
          <div class="section">
            <div class="section-title">Reference Details</div>
            <div class="info-row">
              <span class="info-label">PO Number:</span>
              <span class="info-value">{{po_number}}</span>
            </div>
            {{#po_details}}
            <div class="info-row">
              <span class="info-label">Incoterm:</span>
              <span class="info-value">{{incoterm}}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Shipping:</span>
              <span class="info-value">{{shipping_rule}}</span>
            </div>
            {{/po_details}}
          </div>
        </div>

        {{#po_details}}
        <div class="section-title">Items Detail</div>
        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-center">Quantity</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {{#items}}
            <tr>
              <td>{{material_name}}</td>
              <td class="text-center">{{quantity}} {{unit}}</td>
              <td class="text-right">₹{{rate}}</td>
              <td class="text-right">₹{{amount}}</td>
            </tr>
            {{/items}}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="total-row">
            <span class="info-label">Subtotal</span>
            <span class="info-value">₹{{subtotal}}</span>
          </div>
          <div class="total-row">
            <span class="info-label">CGST (9%)</span>
            <span class="info-value">₹{{cgst}}</span>
          </div>
          <div class="total-row">
            <span class="info-label">SGST (9%)</span>
            <span class="info-value">₹{{sgst}}</span>
          </div>
          <div class="total-row grand-total">
            <span>Total Payable</span>
            <span>₹{{grand_total}}</span>
          </div>
        </div>
        {{/po_details}}

        <div class="payment-summary">
          <h3>Transaction Details</h3>
          <div class="grid" style="margin-bottom: 0; gap: 40px;">
            <div>
              <div class="info-row">
                <span class="info-label">Payment Mode</span>
                <span class="info-value">{{payment_mode}}</span>
              </div>
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
            </div>
            <div>
              {{#bank_name}}
              <div class="info-row">
                <span class="info-label">Bank Name</span>
                <span class="info-value">{{bank_name}}</span>
              </div>
              {{#account_number}}
              <div class="info-row">
                <span class="info-label">Account No</span>
                <span class="info-value">{{account_number}}</span>
              </div>
              {{/account_number}}
              {{/bank_name}}
              {{#cheque_number}}
              <div class="info-row">
                <span class="info-label">Cheque No</span>
                <span class="info-value">{{cheque_number}}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Cheque Date</span>
                <span class="info-value">{{formatted_cheque_date}}</span>
              </div>
              {{/cheque_number}}
            </div>
          </div>
          <div class="info-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #bfdbfe;">
            <span class="info-label">Amount Paid</span>
            <span class="info-value" style="font-size: 16px; color: #1e40af;">₹{{formatted_amount}}</span>
          </div>
          {{#remarks}}
          <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
            <strong>Remarks:</strong> {{remarks}}
          </div>
          {{/remarks}}
        </div>

        <div class="footer">
          <p>This is a computer-generated payment voucher and does not require a physical signature.</p>
          <p>SPTECHPIONEER PVT LTD | Confidential | Generated on {{current_timestamp}}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const viewData = {
    ...payment,
    vendor_name: vendor?.vendor_name || 'N/A',
    email: vendor?.email || 'N/A',
    location: vendor?.location || 'N/A',
    phone: vendor?.phone || 'N/A',
    formatted_date: formatDate(payment.payment_date),
    formatted_cheque_date: formatDate(payment.cheque_date),
    formatted_amount: parseFloat(payment.payment_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    remarks: payment.remarks || '',
    po_details: poDetails,
    current_timestamp: new Date().toLocaleString('en-IN')
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
    `SELECT vendor_name as company_name, email 
     FROM vendors 
     WHERE id = ?`,
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
