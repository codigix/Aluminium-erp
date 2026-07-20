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
          SELECT jc.job_card_no, ql.vendor_invoice_no 
          FROM job_card_quality_logs ql
          JOIN job_cards jc ON ql.job_card_id = jc.id
          WHERE ql.id = ?
        `, [jobCardQualityLogId]);
        if (qlRows.length > 0) {
          referenceNo = qlRows[0].vendor_invoice_no || qlRows[0].job_card_no;
        }
      }
    }

    let bankAccountId = null;
    let manualBankAccount = null;

    if (bankAccount) {
      const isNumericId = !isNaN(parseInt(bankAccount)) && isFinite(bankAccount);
      if (isNumericId) {
        const [banks] = await pool.query('SELECT id FROM bank_accounts WHERE id = ?', [parseInt(bankAccount)]);
        if (banks.length > 0) {
          bankAccountId = parseInt(bankAccount);
        } else {
          manualBankAccount = bankAccount;
        }
      } else {
        manualBankAccount = bankAccount;
      }
    }

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
      COALESCE(po.po_number, ql.vendor_invoice_no, jc.job_card_no) as po_number,
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

  if (filters.poId) {
    query += ' AND p.po_id = ?';
    params.push(filters.poId);
  }

  if (filters.jobCardQualityLogId) {
    query += ' AND p.job_card_quality_log_id = ?';
    params.push(filters.jobCardQualityLogId);
  }

  query += ' ORDER BY p.created_at DESC';

  const [payments] = await pool.query(query, params);
  return payments;
};

const getPaymentById = async (paymentId) => {
  const [rows] = await pool.query(
    `SELECT 
      p.*,
      COALESCE(po.po_number, ql.vendor_invoice_no, jc.job_card_no) as po_number,
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
      vi.po_id as id,
      vi.id as vendor_invoice_id,
      vi.po_number,
      vi.po_amount as total_amount,
      vi.created_at,
      vi.po_pdf_path as invoice_url,
      v.vendor_name,
      v.id as vendor_id,
      'PURCHASE_ORDER' as type,
      COALESCE((SELECT SUM(payment_amount) FROM payments WHERE po_id = vi.po_id AND status = 'CONFIRMED'), 0) as already_paid,
      (vi.po_amount - COALESCE((SELECT SUM(payment_amount) FROM payments WHERE po_id = vi.po_id AND status = 'CONFIRMED'), 0)) as outstanding
    FROM vendor_invoices vi
    LEFT JOIN vendors v ON vi.vendor_id = v.id
    WHERE vi.status IN ('VERIFIED', 'COMPLETED')
    HAVING outstanding >= 0`
  );

  const [subconPayments] = await pool.query(
    `SELECT 
      ql.id,
      COALESCE(ql.vendor_invoice_no, jc.job_card_no) as po_number,
      ql.grand_total as total_amount,
      ql.check_date as created_at,
      ql.vendor_invoice as invoice_url,
      v.vendor_name,
      v.id as vendor_id,
      'SUBCONTRACTING' as type,
      COALESCE((SELECT SUM(payment_amount) FROM payments WHERE job_card_quality_log_id = ql.id AND status = 'CONFIRMED'), 0) as already_paid,
      (ql.grand_total - COALESCE((SELECT SUM(payment_amount) FROM payments WHERE job_card_quality_log_id = ql.id AND status = 'CONFIRMED'), 0)) as outstanding
    FROM job_card_quality_logs ql
    JOIN job_cards jc ON ql.job_card_id = jc.id
    JOIN outward_challans oc ON jc.id = oc.job_card_id
    JOIN vendors v ON oc.vendor_id = v.id
    WHERE ql.status IN ('PROCESSING', 'APPROVED', 'PAID') AND ql.grand_total > 0
    HAVING outstanding >= 0`
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

function numberToWords(num) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n) {
    if (n < 20) return a[n];
    const digit = n % 10;
    if (n < 100) return b[Math.floor(n / 10)] + (digit ? '-' + a[digit] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 === 0 ? '' : ' and ' + convert(n % 100));
    return '';
  }

  const n = Math.floor(num);
  if (n === 0) return 'Zero';

  let words = '';
  if (Math.floor(n / 10000000) > 0) {
    words += convert(Math.floor(n / 10000000)) + ' Crore ';
  }
  if (Math.floor((n % 10000000) / 100000) > 0) {
    words += convert(Math.floor((n % 10000000) / 100000)) + ' Lakh ';
  }
  if (Math.floor((n % 100000) / 1000) > 0) {
    words += convert(Math.floor((n % 100000) / 1000)) + ' Thousand ';
  }
  const rem = n % 1000;
  if (rem > 0) {
    words += convert(rem);
  }

  const paise = Math.round((num - n) * 100);
  if (paise > 0) {
    return 'Rupees ' + words.trim() + ' and ' + convert(paise) + ' Paise Only';
  }

  return 'Rupees ' + words.trim() + ' Only';
}

const formatDimensions = (item) => {
  if (!item) return '';

  const len = parseFloat(item.length || 0);
  const wid = parseFloat(item.width || 0);
  const thk = parseFloat(item.thickness || 0);
  const dia = parseFloat(item.diameter || 0);
  const od = parseFloat(item.outer_diameter || item.outerDiameter || 0);

  if (len === 0 && wid === 0 && thk === 0 && dia === 0 && od === 0) {
    return '';
  }

  // Determine shape
  let shape = (
    item.shape_type || 
    item.shape_name || 
    item.shape || 
    item.material_name || 
    item.name || 
    item.item_name || 
    item.item_code || 
    ''
  ).toLowerCase();

  let matchedShape = '';
  if (shape.includes('square') || shape.includes('sq') || shape.includes('box')) {
    matchedShape = 'square tube';
  } else if (shape.includes('rectangular') || shape.includes('rect') || shape.includes('rt')) {
    matchedShape = 'rectangular tube';
  } else if (shape.includes('hex') || shape.includes('hexagonal')) {
    matchedShape = 'hexagonal bar';
  } else if (shape.includes('plate') || shape.includes('sheet') || shape.includes('flat') || shape.includes('profile')) {
    matchedShape = 'plate';
  } else if (shape.includes('pipe') || shape.includes('tube')) {
    matchedShape = 'pipe';
  } else if (shape.includes('round') || shape.includes('rod') || shape.includes('bar')) {
    matchedShape = 'round';
  } else {
    // Fallback detection by dimension values
    if (dia > 0) {
      matchedShape = 'round';
    } else if (od > 0 && thk > 0) {
      matchedShape = 'pipe';
    } else if (wid > 0 && thk > 0 && len > 0) {
      matchedShape = 'plate';
    } else if (wid > 0 && len > 0) {
      matchedShape = 'hexagonal bar';
    } else {
      matchedShape = 'plate';
    }
  }

  const fmt = (label, val) => {
    if (!val || parseFloat(val) === 0) return null;
    const num = parseFloat(val);
    const formatted = num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
    return `${label}:${formatted}`;
  };

  let parts = [];
  if (matchedShape === 'square tube') {
    parts = [fmt('A', wid), fmt('T', thk), fmt('L', len)];
  } else if (matchedShape === 'rectangular tube') {
    parts = [fmt('W', wid), fmt('H', od), fmt('T', thk), fmt('L', len)];
  } else if (matchedShape === 'round') {
    const dVal = dia > 0 ? dia : (od > 0 ? od : wid);
    parts = [fmt('D', dVal), fmt('L', len)];
  } else if (matchedShape === 'pipe') {
    const odVal = od > 0 ? od : dia;
    parts = [fmt('OD', odVal), fmt('T', thk), fmt('L', len)];
  } else if (matchedShape === 'hexagonal bar') {
    parts = [fmt('AF', wid), fmt('L', len)];
  } else if (matchedShape === 'plate') {
    parts = [fmt('W', wid), fmt('T', thk), fmt('L', len)];
  } else {
    parts = [fmt('OD', od), fmt('W', wid), fmt('T', thk), fmt('Dia', dia), fmt('L', len)];
  }

  const cleanParts = parts.filter(Boolean);
  if (cleanParts.length === 0) return '';
  return cleanParts.join(' × ') + ' mm';
};

const generateVendorInvoicePDF = async (id, type) => {
  const adminCompanyMasterService = require('./adminCompanyMasterService');
  const activeCompany = await adminCompanyMasterService.getActiveCompany();
  const hostCompanyName = activeCompany?.company_name || 'SP TECHPIONEER PRIVATE LIMITED';
  const hostCompanyAddress = activeCompany?.company_address || 'PLOT NO.97, SECTOR NO 07, PCNDTA\nBHOSARI, PUNE-411026';
  const hostCompanyAddressLines = hostCompanyAddress ? hostCompanyAddress.split('\n') : ['PLOT NO.97, SECTOR NO 07, PCNDTA', 'BHOSARI, PUNE-411026'];
  const hostGSTIN = activeCompany?.gstin || '27AAPCS1193L1ZQ';
  const hostPAN = activeCompany?.pan || 'N/A';

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  let vendor_name = '';
  let vendor_address = '';
  let vendor_gstin = '';
  let invoice_no = '';
  let created_at = '';
  let po_number = '';
  let po_date = '';
  let itemsList = [];
  let subtotal = 0;
  let cgst_total = 0;
  let sgst_total = 0;
  let cgst_rate = 9;
  let sgst_rate = 9;
  let net_total = 0;

  if (type === 'SUBCONTRACTING') {
    const [logRows] = await pool.query(
      `SELECT ql.*, v.vendor_name, v.gstin as vendor_gstin, v.location as vendor_address,
              jc.job_card_no, oc.challan_number as outward_challan_no, oc.created_at as outward_challan_date
       FROM job_card_quality_logs ql
       JOIN job_cards jc ON ql.job_card_id = jc.id
       JOIN outward_challans oc ON jc.id = oc.job_card_id
       JOIN vendors v ON oc.vendor_id = v.id
       WHERE ql.id = ?`,
      [id]
    );

    if (logRows.length === 0) throw new Error('Subcontract quality log not found');
    const log = logRows[0];

    vendor_name = log.vendor_name;
    vendor_address = log.vendor_address || 'N/A';
    vendor_gstin = log.vendor_gstin || 'N/A';
    invoice_no = log.vendor_invoice_no || `VI-${log.id}`;
    created_at = formatDate(log.check_date);
    po_number = log.outward_challan_no || log.job_card_no;
    po_date = formatDate(log.outward_challan_date);

    subtotal = parseFloat(log.sub_total || 0);
    const gstTotal = parseFloat(log.gst_amount || 0);
    cgst_total = (gstTotal / 2);
    sgst_total = (gstTotal / 2);
    net_total = parseFloat(log.grand_total || 0);

    const [itemRows] = await pool.query(
      `SELECT ici.*,
              COALESCE(
                (SELECT description FROM items WHERE item_code = ici.item_code LIMIT 1),
                ici.item_code
              ) as description,
              COALESCE(
                (SELECT hsn_code FROM stock_balance WHERE item_code = ici.item_code LIMIT 1),
                '84790000'
              ) as hsn_code
       FROM inward_challan_items ici
       JOIN inward_challans ic ON ici.inward_challan_id = ic.id
       JOIN outward_challans oc ON ic.outward_challan_id = oc.id
       WHERE ici.inward_challan_id = ?`,
      [log.inward_challan_id]
    );

    itemsList = itemRows.map((item, idx) => ({
      index: idx + 1,
      description: item.description,
      hsn_code: item.hsn_code,
      quantity: item.accepted_qty,
      unit: 'Nos',
      rate: parseFloat(item.rate || 0).toFixed(2),
      item_amount: (item.accepted_qty * (item.rate || 0)).toFixed(2),
      dimensions: formatDimensions(item)
    }));
  } else {
    const [poRows] = await pool.query(
      `SELECT po.*, v.vendor_name, v.gstin as vendor_gstin, v.location as vendor_address
       FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       WHERE po.id = ?`,
      [id]
    );

    if (poRows.length === 0) throw new Error('Purchase Order not found');
    const po = poRows[0];

    vendor_name = po.vendor_name;
    vendor_address = po.vendor_address || 'N/A';
    vendor_gstin = po.vendor_gstin || 'N/A';
    invoice_no = po.po_number;
    created_at = formatDate(po.created_at);
    po_number = po.po_number;
    po_date = formatDate(po.created_at);

    const [itemRows] = await pool.query(
      `SELECT poi.*,
              COALESCE(
                (SELECT hsn_code FROM stock_balance WHERE item_code = poi.item_code LIMIT 1),
                '84790000'
              ) as hsn_code
       FROM purchase_order_items poi
       WHERE poi.purchase_order_id = ?`,
      [id]
    );

    subtotal = itemRows.reduce((sum, item) => sum + (item.quantity * item.unit_rate), 0);
    cgst_total = itemRows.reduce((sum, item) => sum + parseFloat(item.cgst_amount || 0), 0);
    sgst_total = itemRows.reduce((sum, item) => sum + parseFloat(item.sgst_amount || 0), 0);
    net_total = parseFloat(po.total_amount || 0);

    itemsList = itemRows.map((item, idx) => ({
      index: idx + 1,
      description: item.material_name || item.material_code,
      hsn_code: item.hsn_code,
      quantity: item.quantity,
      unit: item.unit || 'Nos',
      rate: parseFloat(item.unit_rate || 0).toFixed(2),
      item_amount: (item.quantity * (item.unit_rate || 0)).toFixed(2),
      dimensions: formatDimensions(item)
    }));
  }

  const [paymentRows] = await pool.query(
    type === 'SUBCONTRACTING'
      ? `SELECT COALESCE(SUM(payment_amount), 0) as paid_amount FROM payments WHERE job_card_quality_log_id = ? AND status = 'CONFIRMED'`
      : `SELECT COALESCE(SUM(payment_amount), 0) as paid_amount FROM payments WHERE po_id = ? AND status = 'CONFIRMED'`,
    [id]
  );
  const paidAmount = Number(paymentRows[0].paid_amount || 0);
  const balanceAmount = net_total - paidAmount;
  let paymentStatus = 'Pending';
  if (balanceAmount <= 0) {
    paymentStatus = 'Completed';
  } else if (paidAmount > 0) {
    paymentStatus = 'Partial';
  }

  const invoice_summary = {
    invoice_amount: net_total.toFixed(2),
    paid_amount: paidAmount.toFixed(2),
    balance_amount: balanceAmount.toFixed(2),
    status: paymentStatus !== 'Pending' ? paymentStatus : null
  };

  const net_total_words = numberToWords(net_total);
  const empty_rows = Array(Math.max(0, 5 - itemsList.length)).fill({});

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #000; line-height: 1.3; margin: 0; font-size: 10px; }
        .invoice-container { border: 1px solid #000; min-height: 270mm; position: relative; }
        
        .tax-invoice-label { text-align: center; border-bottom: 1px solid #000; font-weight: bold; font-size: 14px; padding: 5px; }
        
        .header-section { display: flex; border-bottom: 1px solid #000; }
        .header-left { flex: 1.5; padding: 10px; border-right: 1px solid #000; }
        .header-right { flex: 1; padding: 10px; }
        
        .company-name { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
        .address-text { font-size: 9px; margin-bottom: 2px; }
        
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; width: 100%; border-bottom: 1px solid #000; }
        .info-box { padding: 8px; border-right: 1px solid #000; min-height: 80px; }
        .info-box:last-child { border-right: none; }
        .label { font-weight: bold; text-decoration: underline; margin-bottom: 5px; display: block; font-size: 11px; }
        
        .meta-table { width: 100%; border-collapse: collapse; }
        .meta-table td { padding: 4px; border: 1px solid #000; }
        .meta-label { font-weight: bold; width: 40%; }
        
        .items-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #000; }
        .items-table th { border: 1px solid #000; padding: 6px; background: #f0f0f0; font-weight: bold; text-align: center; font-size: 9px; }
        .items-table td { border-left: 1px solid #000; border-right: 1px solid #000; padding: 6px; vertical-align: top; }
        .items-table tr.item-row { min-height: 30px; }
        
        .total-section { display: flex; border-bottom: 1px solid #000; }
        .words-section { flex: 1.5; padding: 10px; border-right: 1px solid #000; }
        .calc-section { flex: 1; }
        
        .calc-table { width: 100%; border-collapse: collapse; }
        .calc-table td { padding: 5px; border-bottom: 1px solid #000; text-align: right; }
        .calc-table td:first-child { text-align: left; font-weight: bold; border-right: 1px solid #000; }
        .calc-table tr:last-child td { border-bottom: none; font-size: 12px; font-weight: bold; }
        
        .footer-section { display: flex; padding: 20px 10px; border-top: 1px solid #000; position: absolute; bottom: 0; width: 100%; box-sizing: border-box; }
        .footer-col { flex: 1; text-align: center; }
        .signature-box { margin-top: 40px; border-top: 1px dashed #000; display: inline-block; min-width: 150px; padding-top: 5px; }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="tax-invoice-label">TAX INVOICE</div>
        
        <div class="header-section">
          <div class="header-left">
            <div class="company-name">{{vendor_name}}</div>
            <div class="address-text">{{vendor_address}}</div>
            {{#vendor_gstin}}<div class="address-text">GSTIN/UIN: {{vendor_gstin}}</div>{{/vendor_gstin}}
          </div>
          <div class="header-right">
            <table class="meta-table">
              <tr>
                <td class="meta-label">Invoice No.</td>
                <td>{{invoice_no}}</td>
              </tr>
              <tr>
                <td class="meta-label">Dated</td>
                <td>{{created_at}}</td>
              </tr>
              <tr>
                <td class="meta-label">Buyer's Order No.</td>
                <td>{{po_number}}</td>
              </tr>
              <tr>
                <td class="meta-label">PO Date</td>
                <td>{{po_date}}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="info-box">
            <span class="label">Consignee (Ship to)</span>
            <div style="font-weight: bold; font-size: 11px;">{{hostCompanyName}}</div>
            {{#hostCompanyAddressLines}}
            <div class="address-text">{{.}}</div>
            {{/hostCompanyAddressLines}}
            <div class="address-text">GSTIN/UIN: {{hostGSTIN}}</div>
          </div>
          <div class="info-box">
            <span class="label">Buyer (Bill to)</span>
            <div style="font-weight: bold; font-size: 11px;">{{hostCompanyName}}</div>
            {{#hostCompanyAddressLines}}
            <div class="address-text">{{.}}</div>
            {{/hostCompanyAddressLines}}
            <div class="address-text">GSTIN/UIN: {{hostGSTIN}}</div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 30px;">Sl No.</th>
              <th>Description of Goods</th>
              <th style="width: 70px;">HSN/SAC</th>
              <th style="width: 60px;">Quantity</th>
              <th style="width: 80px;">Rate</th>
              <th style="width: 40px;">per</th>
              <th style="width: 90px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            {{#items}}
            <tr class="item-row">
              <td style="text-align: center;">{{index}}</td>
              <td>
                <div style="font-weight: bold;">{{description}}</div>
                {{#dimensions}}
                <div style="font-size: 8px; color: #555; margin-top: 2px;">{{dimensions}}</div>
                {{/dimensions}}
              </td>
              <td style="text-align: center;">{{hsn_code}}</td>
              <td style="text-align: center;">{{quantity}} {{unit}}</td>
              <td style="text-align: right;">{{rate}}</td>
              <td style="text-align: center;">{{unit}}</td>
              <td style="text-align: right; font-weight: bold;">{{item_amount}}</td>
            </tr>
            {{/items}}
            {{#empty_rows}}
            <tr style="height: 25px;">
              <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
            {{/empty_rows}}
          </tbody>
        </table>

        <div class="total-section">
          <div class="words-section">
            <div style="font-style: italic; margin-bottom: 10px;">Amount Chargeable (in words)</div>
            <div style="font-weight: bold; font-size: 11px;">{{net_total_words}}</div>
          </div>
          <div class="calc-section">
            <table class="calc-table">
              <tr>
                <td>Total Taxable Value</td>
                <td>{{subtotal}}</td>
              </tr>
              {{#cgst_total}}
              <tr>
                <td>CGST @ {{cgst_rate}}%</td>
                <td>{{cgst_total}}</td>
              </tr>
              {{/cgst_total}}
              {{#sgst_total}}
              <tr>
                <td>SGST @ {{sgst_rate}}%</td>
                <td>{{sgst_total}}</td>
              </tr>
              {{/sgst_total}}
              <tr>
                <td>Total</td>
                <td>₹ {{net_total}}</td>
              </tr>
            </table>
            {{#invoice_summary}}
            <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 6px; font-size: 8px; font-weight: bold; background: #f5f5f5; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
              Invoice Summary
            </div>
            <table class="calc-table" style="border-top: none;">
              <tr>
                <td>Invoice Amount</td>
                <td style="font-weight: bold;">₹ {{invoice_amount}}</td>
              </tr>
              <tr>
                <td>Paid Amount</td>
                <td style="font-weight: bold; color: #16a34a;">₹ {{paid_amount}}</td>
              </tr>
              <tr>
                <td>Balance Amount</td>
                <td style="font-weight: bold; color: #dc2626;">₹ {{balance_amount}}</td>
              </tr>
              {{#status}}
              <tr>
                <td>Status</td>
                <td style="font-weight: bold; text-transform: uppercase;">{{status}}</td>
              </tr>
              {{/status}}
            </table>
            {{/invoice_summary}}
          </div>
        </div>

        <div class="footer-section">
          <div class="footer-col" style="text-align: left;">
            <div style="font-weight: bold; margin-bottom: 5px;">Declaration:</div>
            <div style="font-size: 8px; line-height: 1.2;">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</div>
          </div>
          <div class="footer-col" style="text-align: right;">
            <div>For {{vendor_name}}</div>
            <div class="signature-box">Authorized Signatory</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  const renderedHtml = mustache.render(htmlTemplate, {
    hostCompanyName,
    hostCompanyAddressLines,
    hostGSTIN,
    hostPAN,
    vendor_name,
    vendor_address,
    vendor_gstin,
    invoice_no,
    created_at,
    po_number,
    po_date,
    items: itemsList,
    subtotal: subtotal.toFixed(2),
    cgst_total: cgst_total > 0 ? cgst_total.toFixed(2) : null,
    sgst_total: sgst_total > 0 ? sgst_total.toFixed(2) : null,
    cgst_rate,
    sgst_rate,
    net_total: net_total.toFixed(2),
    net_total_words,
    empty_rows,
    invoice_summary
  });

  await page.setContent(renderedHtml, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '10mm',
      bottom: '10mm',
      left: '10mm',
      right: '10mm'
    }
  });

  await browser.close();
  return pdfBuffer;
};

const sendVendorInvoiceEmail = async (id, type, emailData = {}) => {
  let vendorName = '';
  let recipientEmail = emailData.to;
  let invoiceNo = '';

  if (type === 'SUBCONTRACTING') {
    const [rows] = await pool.query(
      `SELECT ql.vendor_invoice_no, v.vendor_name, v.email
       FROM job_card_quality_logs ql
       JOIN job_cards jc ON ql.job_card_id = jc.id
       JOIN outward_challans oc ON jc.id = oc.job_card_id
       JOIN vendors v ON oc.vendor_id = v.id
       WHERE ql.id = ?`,
      [id]
    );
    if (rows.length > 0) {
      if (!recipientEmail) recipientEmail = rows[0].email;
      vendorName = rows[0].vendor_name;
      invoiceNo = rows[0].vendor_invoice_no || `VI-${id}`;
    }
  } else {
    const [rows] = await pool.query(
      `SELECT po.po_number, v.vendor_name, v.email
       FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       WHERE po.id = ?`,
      [id]
    );
    if (rows.length > 0) {
      if (!recipientEmail) recipientEmail = rows[0].email;
      vendorName = rows[0].vendor_name;
      invoiceNo = rows[0].po_number;
    }
  }

  if (!recipientEmail) {
    throw new Error('Vendor email address not found');
  }

  const subject = emailData.subject || `Vendor Invoice - ${invoiceNo}`;
  const message = emailData.message || `Dear ${vendorName || 'Vendor'},
  
Please find attached the vendor invoice ${invoiceNo}.

Best Regards,
Accounts Department
SPTECHPIONEER PVT LTD`;

  const attachments = [];
  if (emailData.attachPDF !== false) {
    const pdfBuffer = await generateVendorInvoicePDF(id, type);
    attachments.push({
      filename: `Invoice-${invoiceNo}.pdf`,
      content: pdfBuffer
    });
  }

  if (emailData.customAttachments && Array.isArray(emailData.customAttachments)) {
    for (const att of emailData.customAttachments) {
      attachments.push({
        filename: att.filename,
        content: att.content,
        encoding: 'base64'
      });
    }
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
  sendPaymentVoucherEmail,
  generateVendorInvoicePDF,
  sendVendorInvoiceEmail
};
