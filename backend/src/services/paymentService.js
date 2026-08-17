const pool = require('../config/db');
const puppeteer = require('puppeteer');
const mustache = require('mustache');
const path = require('path');
const fs = require('fs');
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

  const shape = (
    item.shape_type || item.shape_name || item.shape ||
    item.material_name || item.name || item.item_name || item.item_code || ''
  ).toLowerCase();

  let matchedShape = '';
  if (shape.includes('threaded') || shape.includes('thread')) matchedShape = 'threaded rod';
  else if (shape.includes('square tube') || (shape.includes('square') && shape.includes('tube'))) matchedShape = 'square tube';
  else if (shape.includes('rectangular tube') || shape.includes('rect tube') || (shape.includes('rect') && shape.includes('tube'))) matchedShape = 'rectangular tube';
  else if (shape.includes('square bar') || (shape.includes('square') && shape.includes('bar'))) matchedShape = 'square bar';
  else if (shape.includes('rectangular bar') || (shape.includes('rect') && shape.includes('bar'))) matchedShape = 'rectangular bar';
  else if (shape.includes('hex') || shape.includes('hexagonal')) matchedShape = 'hexagonal bar';
  else if (shape.includes('unequal angle')) matchedShape = 'unequal angle';
  else if (shape.includes('equal angle')) matchedShape = 'equal angle';
  else if (shape.includes('angle')) matchedShape = 'angle';
  else if (shape.includes('plate') || shape.includes('sheet')) matchedShape = 'plate';
  else if (shape.includes('flat')) matchedShape = 'flat bar';
  else if (shape.includes('pipe') || shape.includes('tube')) matchedShape = 'pipe';
  else if (shape.includes('round') || shape.includes('rod') || shape.includes('bar')) matchedShape = 'round bar';
  else if (dia > 0) matchedShape = 'round bar';
  else if (od > 0 && thk > 0) matchedShape = 'pipe';
  else if (wid > 0 && thk > 0 && len > 0) matchedShape = 'plate';
  else matchedShape = 'plate';

  const nf = (v) => {
    if (!v || isNaN(parseFloat(v)) || parseFloat(v) === 0) return null;
    const num = parseFloat(v);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
  };

  let prefix = '', dimParts = [];
  if (matchedShape === 'plate')              { prefix = 'PL';   dimParts = [nf(wid), nf(len), nf(thk)]; }
  else if (matchedShape === 'flat bar')      { prefix = 'FB';   dimParts = [nf(wid), nf(thk), nf(len)]; }
  else if (matchedShape === 'round bar')     { prefix = 'RB';   const dv = dia > 0 ? dia : (od > 0 ? od : wid); dimParts = [`Ø${nf(dv)}`, nf(len)]; }
  else if (matchedShape === 'hexagonal bar') { prefix = 'HEX';  dimParts = [`AF${nf(wid)}`, nf(len)]; }
  else if (matchedShape === 'square bar')    { prefix = 'SQ';   dimParts = [nf(wid), nf(len)]; }
  else if (matchedShape === 'rectangular bar') { prefix = 'REC'; dimParts = [nf(wid), nf(od), nf(len)]; }
  else if (matchedShape === 'pipe')          { prefix = 'PIPE'; const ov = od > 0 ? od : dia; dimParts = [`OD${nf(ov)}`, nf(thk), nf(len)]; }
  else if (matchedShape === 'square tube')   { prefix = 'SQT';  dimParts = [nf(wid), nf(thk), nf(len)]; }
  else if (matchedShape === 'rectangular tube') { prefix = 'RCT'; dimParts = [nf(wid), nf(od), nf(thk), nf(len)]; }
  else if (matchedShape === 'threaded rod')  { prefix = 'TR';   const dv = dia > 0 ? dia : od; const pv = parseFloat(item.thread_pitch || item.threadPitch || thk || item.thickness || 0); dimParts = [`M${nf(dv)}`, pv > 0 ? nf(pv) : null, nf(len)]; }
  else if (matchedShape === 'angle')         { prefix = 'L';    dimParts = [nf(wid), nf(od || thk), nf(thk), nf(len)]; }
  else if (matchedShape === 'equal angle')   { prefix = 'EA';   dimParts = [nf(wid), nf(wid), nf(thk), nf(len)]; }
  else if (matchedShape === 'unequal angle') { prefix = 'UA';   dimParts = [nf(wid), nf(od), nf(thk), nf(len)]; }
  else { dimParts = [nf(wid), nf(od), nf(thk), nf(dia), nf(len)]; }

  const clean = dimParts.filter(Boolean);
  if (clean.length === 0) return '';
  return `${prefix} ${clean.join(' × ')} mm`.trim();
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
  let po = {};
  let grn = null;

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
    let targetPoId = id;
    if (type === 'GRN' || type === 'PO_RECEIPT') {
      const poReceiptService = require('./poReceiptService');
      let receipt = await poReceiptService.getPOReceiptById(id);
      if (!receipt) {
        const [gRows] = await pool.query('SELECT po_receipt_id FROM grns WHERE id = ?', [id]);
        if (gRows.length > 0 && gRows[0].po_receipt_id) {
          receipt = await poReceiptService.getPOReceiptById(gRows[0].po_receipt_id);
        }
      }

      if (receipt) {
        targetPoId = receipt.po_id;
        const [poRows] = await pool.query(
          `SELECT po.*, v.vendor_code, v.vendor_name, v.gstin as vendor_gstin, v.location as vendor_address,
                  v.email as vendor_email, v.phone as vendor_phone
           FROM purchase_orders po
           LEFT JOIN vendors v ON po.vendor_id = v.id
           WHERE po.id = ?`,
          [targetPoId]
        );
        po = poRows.length > 0 ? poRows[0] : {};
        grn = { grn_no: `GRN-${String(receipt.id).padStart(4, '0')}`, grn_date: receipt.receipt_date || receipt.created_at };

        vendor_name = po.vendor_name || 'N/A';
        vendor_address = po.vendor_address || 'N/A';
        vendor_gstin = po.vendor_gstin || 'N/A';
        invoice_no = `INV-GRN-${String(receipt.id).padStart(4, '0')}`;
        created_at = formatDate(receipt.receipt_date || receipt.created_at);
        po_number = receipt.po_number || po.po_number || 'N/A';
        po_date = formatDate(po.created_at);

        const receiptItems = receipt.items || [];
        subtotal = 0;

        itemsList = receiptItems.map((item, idx) => {
          const recQty = parseFloat(item.received_qty || item.received_quantity || 0);
          const recWt = parseFloat(item.received_weight || 0);
          const unitRate = parseFloat(item.unit_rate || item.rate || 0);

          const unitRaw = (item.unit || 'Nos').trim().toLowerCase();
          const isKgItem = unitRaw === 'kg' || unitRaw === 'kgs' || recWt > 0;

          let qtyFormatted;
          let weightFormatted;
          let lineAmount = 0;

          if (isKgItem && recWt > 0) {
            qtyFormatted = recQty > 0 ? (recQty % 1 === 0 ? String(Math.round(recQty)) : recQty.toFixed(3)) : '1';
            weightFormatted = `${recWt.toFixed(3)} Kg`;
            lineAmount = recWt * unitRate;
          } else {
            qtyFormatted = recQty % 1 === 0 ? String(Math.round(recQty)) : recQty.toFixed(3);
            weightFormatted = '—';
            lineAmount = recQty * unitRate;
          }

          subtotal += lineAmount;

          const len = parseFloat(item.length || 0);
          const wid = parseFloat(item.width || 0);
          const thk = parseFloat(item.thickness || 0);
          const dia = parseFloat(item.diameter || 0);
          const od = parseFloat(item.outer_diameter || 0);
          const shapeRaw = (item.shape_type || item.shape_name || item.material_name || '').toLowerCase();
          const nf = (v) => { if (!v || isNaN(parseFloat(v))) return null; const num = parseFloat(v); return num % 1 === 0 ? num.toFixed(0) : num.toFixed(1); };

          let matchedShape = '';
          if (shapeRaw.includes('threaded') || shapeRaw.includes('thread')) matchedShape = 'threaded rod';
          else if (shapeRaw.includes('square tube')) matchedShape = 'square tube';
          else if (shapeRaw.includes('rectangular tube')) matchedShape = 'rectangular tube';
          else if (shapeRaw.includes('square bar')) matchedShape = 'square bar';
          else if (shapeRaw.includes('rectangular bar')) matchedShape = 'rectangular bar';
          else if (shapeRaw.includes('hex')) matchedShape = 'hexagonal bar';
          else if (shapeRaw.includes('unequal angle')) matchedShape = 'unequal angle';
          else if (shapeRaw.includes('equal angle')) matchedShape = 'equal angle';
          else if (shapeRaw.includes('angle')) matchedShape = 'angle';
          else if (shapeRaw.includes('plate') || shapeRaw.includes('sheet')) matchedShape = 'plate';
          else if (shapeRaw.includes('flat')) matchedShape = 'flat bar';
          else if (shapeRaw.includes('pipe') || shapeRaw.includes('tube')) matchedShape = 'pipe';
          else if (shapeRaw.includes('round') || shapeRaw.includes('rod') || shapeRaw.includes('bar')) {
            if (thk > 0) matchedShape = 'threaded rod'; else matchedShape = 'round bar';
          } else if (dia > 0) {
            if (thk > 0) matchedShape = 'threaded rod'; else matchedShape = 'round bar';
          } else if (od > 0 && thk > 0) matchedShape = 'pipe';
          else if (wid > 0 && thk > 0 && len > 0) matchedShape = 'plate';

          let dimPrefix = '', dimParts = [];
          if (matchedShape === 'plate')           { dimPrefix = 'PL';   dimParts = [nf(wid), nf(len), nf(thk)]; }
          else if (matchedShape === 'flat bar')   { dimPrefix = 'FB';   dimParts = [nf(wid), nf(thk), nf(len)]; }
          else if (matchedShape === 'round bar')  { dimPrefix = 'RB';   const dv = dia > 0 ? dia : (od > 0 ? od : wid); dimParts = [`Ø${nf(dv)}`, nf(len)]; }
          else if (matchedShape === 'hexagonal bar') { dimPrefix = 'HEX'; dimParts = [`AF${nf(wid)}`, nf(len)]; }
          else if (matchedShape === 'square bar') { dimPrefix = 'SQ';   dimParts = [nf(wid), nf(len)]; }
          else if (matchedShape === 'rectangular bar') { dimPrefix = 'REC'; dimParts = [nf(wid), nf(od), nf(len)]; }
          else if (matchedShape === 'pipe')       { dimPrefix = 'PIPE'; const ov = od > 0 ? od : dia; dimParts = [`OD${nf(ov)}`, nf(thk), nf(len)]; }
          else if (matchedShape === 'square tube') { dimPrefix = 'SQT'; dimParts = [nf(wid), nf(thk), nf(len)]; }
          else if (matchedShape === 'rectangular tube') { dimPrefix = 'RCT'; dimParts = [nf(wid), nf(od), nf(thk), nf(len)]; }
          else if (matchedShape === 'threaded rod') { dimPrefix = 'TR'; const dv = dia > 0 ? dia : od; dimParts = [`M${nf(dv)}`, nf(len)]; }
          else if (matchedShape === 'angle')      { dimPrefix = 'L';   dimParts = [nf(wid), nf(od || thk), nf(thk), nf(len)]; }
          else if (matchedShape === 'equal angle') { dimPrefix = 'EA'; dimParts = [nf(wid), nf(wid), nf(thk), nf(len)]; }
          else if (matchedShape === 'unequal angle') { dimPrefix = 'UA'; dimParts = [nf(wid), nf(od), nf(thk), nf(len)]; }
          else { dimParts = [nf(wid), nf(od), nf(thk), nf(dia), nf(len)]; }

          const dimPartsClean = dimParts.filter(Boolean);
          const dimsSpec = dimPartsClean.length > 0 ? `${dimPrefix} ${dimPartsClean.join(' × ')} mm`.trim() : '';

          return {
            sr: idx + 1,
            drawingNoOrCode: item.drawing_no || item.item_code || 'N/A',
            itemCode: item.item_code || 'N/A',
            materialName: item.material_name || item.description || 'N/A',
            description: item.material_name || item.description || 'N/A',
            hsnCode: item.hsn_code || '84790000',
            qty: qtyFormatted,
            weight: weightFormatted,
            unit: item.unit || 'Nos',
            rate: unitRate.toFixed(2),
            amount: lineAmount.toFixed(2),
            dimsSpec
          };
        });

        cgst_total = subtotal * 0.09;
        sgst_total = subtotal * 0.09;
        net_total = subtotal + cgst_total + sgst_total;
      }
    } else {
      const [poRows] = await pool.query(
        `SELECT po.*, v.vendor_code, v.vendor_name, v.gstin as vendor_gstin, v.location as vendor_address,
                v.email as vendor_email, v.phone as vendor_phone
         FROM purchase_orders po
         LEFT JOIN vendors v ON po.vendor_id = v.id
         WHERE po.id = ?`,
        [targetPoId]
      );

      if (poRows.length === 0) throw new Error('Purchase Order not found');
      po = poRows[0];

      // Fetch related GRN if available
      const [grnRows] = await pool.query(
        `SELECT g.* FROM grns g
         JOIN po_receipts pr ON g.po_receipt_id = pr.id
         WHERE pr.po_id = ?
         ORDER BY g.id DESC LIMIT 1`,
        [targetPoId]
      );
      grn = grnRows.length > 0 ? grnRows[0] : null;

      vendor_name = po.vendor_name || 'N/A';
      vendor_address = po.vendor_address || 'N/A';
      vendor_gstin = po.vendor_gstin || 'N/A';
      invoice_no = `INV-${po.po_number || po.id}`;
      created_at = formatDate(po.created_at);
      po_number = po.po_number || 'N/A';
      po_date = formatDate(po.created_at);

      const [itemRows] = await pool.query(
        `SELECT poi.*,
                COALESCE(
                  (SELECT hsn_code FROM stock_balance WHERE item_code = poi.item_code LIMIT 1),
                  '84790000'
                ) as hsn_code
         FROM purchase_order_items poi
         WHERE poi.purchase_order_id = ?`,
        [targetPoId]
      );

      subtotal = itemRows.reduce((sum, item) => sum + (item.quantity * item.unit_rate), 0);
      cgst_total = itemRows.reduce((sum, item) => sum + parseFloat(item.cgst_amount || 0), 0);
      sgst_total = itemRows.reduce((sum, item) => sum + parseFloat(item.sgst_amount || 0), 0);
      net_total = parseFloat(po.total_amount || (subtotal + cgst_total + sgst_total));
      itemsList = itemRows.map((item, idx) => {
        let weightVal = parseFloat(item.calculated_weight || item.weight || item.total_weight || item.unit_weight || 0);
        if (weightVal === 0) {
          const len = parseFloat(item.length || item.dimensions?.length || 0);
          const wid = parseFloat(item.width || item.dimensions?.width || 0);
          const thk = parseFloat(item.thickness || item.dimensions?.thickness || 0);
          const dia = parseFloat(item.diameter || item.dimensions?.diameter || 0);
          const od = parseFloat(item.outer_diameter || item.outerDiameter || item.dimensions?.outer_diameter || 0);
          const density = parseFloat(item.density || 7.85);
          const shapeStr = String(item.shape_type || item.shape_name || item.shape || item.material_name || '').trim().toLowerCase();

          if (shapeStr.includes('threaded') || shapeStr.includes('thread')) {
            const dVal = dia > 0 ? dia : od;
            const pVal = parseFloat(item.thread_pitch || item.threadPitch || item.dimensions?.thread_pitch || item.dimensions?.threadPitch || 0);
            if (dVal > 0 && pVal > 0 && pVal < dVal && len > 0) {
              const tensileArea = 0.7854 * Math.pow(dVal - (0.9382 * pVal), 2);
              weightVal = (tensileArea * len * density) / 1000000;
            }
          } else if (len > 0 && wid > 0 && thk > 0) {
            weightVal = (len * wid * thk * density) / 1000000;
          } else if (len > 0 && dia > 0) {
            weightVal = (Math.PI * Math.pow(dia, 2) / 4 * len * density) / 1000000;
          }
        }
        const unitRaw = (item.unit || 'Nos').trim().toLowerCase();
        const isKgItem = unitRaw === 'kg' || unitRaw === 'kgs';

        let qtyFormatted;
        let weightFormatted;

        if (isKgItem) {
          const pieceCount = parseFloat(item.design_qty || item.planned_qty || 1);
          qtyFormatted = pieceCount % 1 === 0 ? String(Math.round(pieceCount)) : pieceCount.toFixed(3);
          const totalWeightKg = weightVal > 0 ? weightVal : parseFloat(item.quantity || 0);
          weightFormatted = totalWeightKg > 0 ? `${totalWeightKg.toFixed(3)} Kg` : '—';
        } else {
          const qty = parseFloat(item.quantity || 0);
          qtyFormatted = qty % 1 === 0 ? String(Math.round(qty)) : qty.toFixed(3);
          weightFormatted = '—';
        }

        const len = parseFloat(item.length || item.dimensions?.length || 0);
        const wid = parseFloat(item.width || item.dimensions?.width || 0);
        const thk = parseFloat(item.thickness || item.dimensions?.thickness || 0);
        const dia = parseFloat(item.diameter || item.dimensions?.diameter || 0);
        const od = parseFloat(item.outer_diameter || item.outerDiameter || item.dimensions?.outer_diameter || 0);
        const shapeRaw = (item.shape_type || item.shape_name || item.shape || item.material_name || '').toLowerCase();

        const nf = (v) => { if (!v || isNaN(parseFloat(v))) return null; const num = parseFloat(v); return num % 1 === 0 ? num.toFixed(0) : num.toFixed(1); };

        let matchedShape = '';
        if (shapeRaw.includes('threaded') || shapeRaw.includes('thread')) matchedShape = 'threaded rod';
        else if (shapeRaw.includes('square tube') || (shapeRaw.includes('square') && shapeRaw.includes('tube'))) matchedShape = 'square tube';
        else if (shapeRaw.includes('rectangular tube') || shapeRaw.includes('rect tube') || (shapeRaw.includes('rect') && shapeRaw.includes('tube'))) matchedShape = 'rectangular tube';
        else if (shapeRaw.includes('square bar') || (shapeRaw.includes('square') && shapeRaw.includes('bar'))) matchedShape = 'square bar';
        else if (shapeRaw.includes('rectangular bar') || (shapeRaw.includes('rect') && shapeRaw.includes('bar'))) matchedShape = 'rectangular bar';
        else if (shapeRaw.includes('hex')) matchedShape = 'hexagonal bar';
        else if (shapeRaw.includes('unequal angle')) matchedShape = 'unequal angle';
        else if (shapeRaw.includes('equal angle')) matchedShape = 'equal angle';
        else if (shapeRaw.includes('angle')) matchedShape = 'angle';
        else if (shapeRaw.includes('plate') || shapeRaw.includes('sheet')) matchedShape = 'plate';
        else if (shapeRaw.includes('flat')) matchedShape = 'flat bar';
        else if (shapeRaw.includes('pipe') || shapeRaw.includes('tube')) matchedShape = 'pipe';
        else if (shapeRaw.includes('round') || shapeRaw.includes('rod') || shapeRaw.includes('bar')) {
          if (thk > 0) matchedShape = 'threaded rod';
          else matchedShape = 'round bar';
        }
        else if (dia > 0) {
          if (thk > 0) matchedShape = 'threaded rod';
          else matchedShape = 'round bar';
        }
        else if (od > 0 && thk > 0) matchedShape = 'pipe';
        else if (wid > 0 && thk > 0 && len > 0) matchedShape = 'plate';

        let dimPrefix = '', dimParts = [];
        if (matchedShape === 'plate')           { dimPrefix = 'PL';   dimParts = [nf(wid), nf(len), nf(thk)]; }
        else if (matchedShape === 'flat bar')   { dimPrefix = 'FB';   dimParts = [nf(wid), nf(thk), nf(len)]; }
        else if (matchedShape === 'round bar')  { dimPrefix = 'RB';   const dv = dia > 0 ? dia : (od > 0 ? od : wid); dimParts = [`Ø${nf(dv)}`, nf(len)]; }
        else if (matchedShape === 'hexagonal bar') { dimPrefix = 'HEX'; dimParts = [`AF${nf(wid)}`, nf(len)]; }
        else if (matchedShape === 'square bar') { dimPrefix = 'SQ';   dimParts = [nf(wid), nf(len)]; }
        else if (matchedShape === 'rectangular bar') { dimPrefix = 'REC'; dimParts = [nf(wid), nf(od), nf(len)]; }
        else if (matchedShape === 'pipe')       { dimPrefix = 'PIPE'; const ov = od > 0 ? od : dia; dimParts = [`OD${nf(ov)}`, nf(thk), nf(len)]; }
        else if (matchedShape === 'square tube') { dimPrefix = 'SQT'; dimParts = [nf(wid), nf(thk), nf(len)]; }
        else if (matchedShape === 'rectangular tube') { dimPrefix = 'RCT'; dimParts = [nf(wid), nf(od), nf(thk), nf(len)]; }
        else if (matchedShape === 'threaded rod') { dimPrefix = 'TR'; const dv = dia > 0 ? dia : od; const pv = parseFloat(item.thread_pitch || item.threadPitch || thk || item.thickness || 0); dimParts = [`M${nf(dv)}`, pv > 0 ? nf(pv) : null, nf(len)]; }
        else if (matchedShape === 'angle')      { dimPrefix = 'L';   dimParts = [nf(wid), nf(od || thk), nf(thk), nf(len)]; }
        else if (matchedShape === 'equal angle') { dimPrefix = 'EA'; dimParts = [nf(wid), nf(wid), nf(thk), nf(len)]; }
        else if (matchedShape === 'unequal angle') { dimPrefix = 'UA'; dimParts = [nf(wid), nf(od), nf(thk), nf(len)]; }
        else { dimParts = [nf(wid), nf(od), nf(thk), nf(dia), nf(len)]; }

        const dimPartsClean = dimParts.filter(Boolean);
        const dimsSpec = dimPartsClean.length > 0 ? `${dimPrefix} ${dimPartsClean.join(' × ')} mm`.trim() : '';

        return {
          sr: idx + 1,
          drawingNoOrCode: item.drawing_no || item.material_code || item.item_code || 'N/A',
          itemCode: item.material_code || item.item_code || 'N/A',
          materialName: item.material_name || item.material_code || 'N/A',
          description: item.material_name || item.material_code || 'N/A',
          hsnCode: item.hsn_code || '84790000',
          qty: qtyFormatted,
          weight: weightFormatted,
          unit: item.unit || 'Nos',
          rate: parseFloat(item.unit_rate || 0).toFixed(2),
          amount: (item.quantity * (item.unit_rate || 0)).toFixed(2),
          dimsSpec
        };
      });
    }

    let logoBase64 = null;
    if (activeCompany && activeCompany.company_logo) {
      const uploadedLogoPath = path.join(__dirname, '../../', activeCompany.company_logo);
      if (fs.existsSync(uploadedLogoPath)) {
        logoBase64 = `data:image/png;base64,${fs.readFileSync(uploadedLogoPath).toString('base64')}`;
      }
    }
    if (!logoBase64) {
      const logoPath = path.join(__dirname, '../../../frontend/src/assets/sptechpioneer logo.png');
      if (fs.existsSync(logoPath)) {
        logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
      }
    }

    // Data packet for vendor-tax-invoice.html template
    const templateData = {
      hostCompanyName,
      hostCompanyShortName: activeCompany?.short_name || 'SPTP',
      hostCompanyAddress: hostCompanyAddress.replace(/\n/g, ', '),
      hostCompanyGST: hostGSTIN,
      hostCompanyLogo: logoBase64,
      vendorName: po.vendor_name || 'N/A',
      vendorCode: po.vendor_code || 'VEN-001',
      contactPerson: po.contact_person || 'N/A',
      vendorEmail: po.vendor_email || 'N/A',
      vendorPhone: po.vendor_phone || 'N/A',
      vendorGST: po.vendor_gstin || 'N/A',
      vendorAddress: po.vendor_address || 'N/A',
      poNumber: po.po_number || 'N/A',
      invoiceNo: `INV-${po.po_number || po.id}`,
      invoiceDate: formatDate(po.created_at),
      grnNo: grn ? (grn.grn_no || `GRN-${grn.id}`) : 'GRN-PENDING',
      grnDate: grn ? formatDate(grn.grn_date || grn.created_at) : formatDate(po.created_at),
      paymentTerms: po.payment_terms || '30 Days',
      dueDate: formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      items: itemsList,
      subTotal: subtotal.toFixed(2),
      cgstRate: cgst_rate,
      cgstAmount: (cgst_total || (subtotal * 0.09)).toFixed(2),
      sgstRate: sgst_rate,
      sgstAmount: (sgst_total || (subtotal * 0.09)).toFixed(2),
      grandTotal: net_total.toFixed(2),
      paymentStatus: 'Pending'
    };

    const templatePath = path.join(__dirname, '../../templates/vendor-tax-invoice.html');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const renderedHtml = mustache.render(templateSource, templateData);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(renderedHtml, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });
    await browser.close();
    return pdfBuffer;
  }
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
