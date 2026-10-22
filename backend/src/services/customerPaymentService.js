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
    salesOrderSource,
    customerId,
    paymentAmount,
    paymentDate,
    paymentMode,
    transactionRefNo,
    remarks,
    bankAccount,
    manualBankAccount,
    upiApp,
    upiTransactionId,
    chequeNumber,
    bankName,
    chequeDate,
    cardType,
    last4Digits,
    authorizationCode,
    allocations,
    createdBy
  } = payload;

  const hasAllocations = Array.isArray(allocations) && allocations.length > 0;
  const receiptNo = await generatePaymentReceiptNo();

  // Logic to handle bank account: either a numeric ID from bank_accounts or a manual string
  let bankAccountId = null;
  let actualManualBankAccount = null;

  if (bankAccount) {
    const isNumericId = !isNaN(parseInt(bankAccount)) && isFinite(bankAccount);
    if (isNumericId) {
      const [banks] = await pool.query('SELECT id FROM bank_accounts WHERE id = ?', [parseInt(bankAccount)]);
      if (banks.length > 0) {
        bankAccountId = parseInt(bankAccount);
        actualManualBankAccount = manualBankAccount || null;
      } else {
        bankAccountId = null;
        actualManualBankAccount = bankAccount;
      }
    } else {
      bankAccountId = null;
      actualManualBankAccount = bankAccount;
    }
  }

  // Calculate final amount & primary references
  let finalPaymentAmount = parseFloat(paymentAmount) || 0;
  let primaryInvoiceId = invoiceId || null;
  let primarySalesOrderId = salesOrderId || null;
  let primarySource = salesOrderSource || (invoiceId ? 'SALES_INVOICE' : 'SALES_ORDER');
  let voucherRemarks = remarks || null;

  if (hasAllocations) {
    const calculatedTotal = allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
    if (!finalPaymentAmount) finalPaymentAmount = calculatedTotal;

    if (allocations.length === 1) {
      primaryInvoiceId = allocations[0].invoiceId || primaryInvoiceId;
      primarySalesOrderId = allocations[0].salesOrderId || primarySalesOrderId;
      primarySource = allocations[0].salesOrderSource || primarySource;
    } else {
      primaryInvoiceId = null;
      primarySalesOrderId = null;
      primarySource = 'SALES_INVOICE';
    }

    const refsSummary = allocations.map(a => `${a.type || 'Agst Ref'}: ${a.referenceNo || a.invoiceNo || a.invoiceId || 'Bill'}`).join(', ');
    if (!voucherRemarks) {
      voucherRemarks = refsSummary;
    } else if (!voucherRemarks.includes('[Agst Ref:') && refsSummary) {
      voucherRemarks = `${voucherRemarks} [${refsSummary}]`;
    }
  }

  try {
    const validSources = ['SALES_ORDER', 'DIRECT_ORDER', 'SALES_INVOICE'];
    const resolvedSource = validSources.includes(primarySource) ? primarySource : 'SALES_INVOICE';

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
        receiptNo,
        primaryInvoiceId,
        primarySalesOrderId,
        resolvedSource,
        customerId,
        finalPaymentAmount,
        paymentDate,
        paymentMode,
        transactionRefNo || null,
        bankAccountId,
        actualManualBankAccount,
        voucherRemarks,
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

    // Insert bill-wise allocations into customer_payment_allocations and update invoice statuses
    if (hasAllocations) {
      for (const alloc of allocations) {
        const allocAmt = parseFloat(alloc.amount) || 0;
        if (allocAmt <= 0) continue;
        const allocInvId = alloc.invoiceId ? parseInt(alloc.invoiceId, 10) : null;
        const allocSoId = alloc.salesOrderId ? parseInt(alloc.salesOrderId, 10) : null;
        const allocSource = alloc.salesOrderSource || 'SALES_INVOICE';
        const allocRef = alloc.referenceNo || alloc.invoiceNo || (allocInvId ? `INV-${allocInvId}` : null);
        const allocCustId = alloc.customerId ? parseInt(alloc.customerId, 10) : customerId;

        await pool.execute(
          `INSERT INTO customer_payment_allocations (
            customer_payment_id,
            receipt_no,
            customer_id,
            invoice_id,
            sales_order_id,
            sales_order_source,
            allocation_type,
            reference_no,
            amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            paymentId,
            receiptNo,
            allocCustId,
            allocInvId,
            allocSoId,
            allocSource,
            alloc.type || 'Agst Ref',
            allocRef,
            allocAmt
          ]
        );

        // Update sales invoice paid status
        if (allocInvId) {
          const [invRows] = await pool.query('SELECT total_amount FROM sales_invoices WHERE id = ?', [allocInvId]);
          if (invRows.length > 0) {
            const [payRows] = await pool.query(
              `SELECT 
                COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa JOIN customer_payments cp ON cpa.customer_payment_id = cp.id WHERE cpa.invoice_id = ? AND cp.status = 'CONFIRMED'), 0) +
                COALESCE((SELECT SUM(cp.payment_amount) FROM customer_payments cp WHERE (cp.invoice_id = ? OR (cp.sales_order_id = ? AND cp.sales_order_source = 'SALES_INVOICE')) AND cp.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM customer_payment_allocations cpa WHERE cpa.customer_payment_id = cp.id)), 0) as total_paid`,
              [allocInvId, allocInvId, allocInvId]
            );
            const totalPaid = parseFloat(payRows[0]?.total_paid) || 0;
            const invoiceTotal = parseFloat(invRows[0].total_amount) || 0;
            if (totalPaid >= invoiceTotal) {
              await pool.execute('UPDATE sales_invoices SET status = ?, updated_at = NOW() WHERE id = ?', ['Paid', allocInvId]);
            } else if (totalPaid > 0) {
              await pool.execute('UPDATE sales_invoices SET status = ?, updated_at = NOW() WHERE id = ?', ['Partially Paid', allocInvId]);
            }
          }
        }
      }
    } else {
      // Legacy single invoice/order update
      if (invoiceId || salesOrderSource === 'SALES_INVOICE') {
        const invTargetId = invoiceId || salesOrderId;
        const [inv] = await pool.query('SELECT total_amount FROM sales_invoices WHERE id = ?', [invTargetId]);
        if (inv.length > 0) {
          const [payments] = await pool.query(
            `SELECT 
              COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa JOIN customer_payments cp ON cpa.customer_payment_id = cp.id WHERE cpa.invoice_id = ? AND cp.status = 'CONFIRMED'), 0) +
              COALESCE((SELECT SUM(cp.payment_amount) FROM customer_payments cp WHERE (cp.invoice_id = ? OR (cp.sales_order_id = ? AND cp.sales_order_source = 'SALES_INVOICE')) AND cp.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM customer_payment_allocations cpa WHERE cpa.customer_payment_id = cp.id)), 0) as total_paid`,
            [invTargetId, invTargetId, invTargetId]
          );
          const totalPaid = parseFloat(payments[0]?.total_paid) || 0;
          const invoiceTotal = parseFloat(inv[0].total_amount) || 0;
          if (totalPaid >= invoiceTotal) {
            await pool.execute('UPDATE sales_invoices SET status = ?, updated_at = NOW() WHERE id = ?', ['Paid', invTargetId]);
          } else if (totalPaid > 0) {
            await pool.execute('UPDATE sales_invoices SET status = ?, updated_at = NOW() WHERE id = ?', ['Partially Paid', invTargetId]);
          }
        }
      }

      if (salesOrderId) {
        if (salesOrderSource === 'DIRECT_ORDER') {
          const [orders] = await pool.query('SELECT grand_total FROM orders WHERE id = ?', [salesOrderId]);
          const [payments] = await pool.query('SELECT SUM(payment_amount) as total_paid FROM customer_payments WHERE sales_order_id = ? AND sales_order_source = ? AND status = ?', [salesOrderId, 'DIRECT_ORDER', 'CONFIRMED']);
          if (orders.length > 0 && payments[0].total_paid >= orders[0].grand_total) {
            await pool.execute('UPDATE orders SET status = ? WHERE id = ?', ['Paid', salesOrderId]);
          }
        } else if (salesOrderSource === 'SALES_ORDER') {
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
        finalPaymentAmount,
        voucherRemarks || (primaryInvoiceId ? `Payment received against invoice ${primaryInvoiceId}` : 'Payment receipt recorded')
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
        finalPaymentAmount,
        voucherRemarks || (primaryInvoiceId ? `Payment received against invoice ${primaryInvoiceId}` : 'Payment receipt recorded'),
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
      CASE 
        WHEN cp.sales_order_source = 'SALES_INVOICE' THEN COALESCE(si.invoice_no, o.order_no)
        WHEN cp.sales_order_source = 'DIRECT_ORDER' THEN o.order_no
        ELSE COALESCE(so.so_number, CONCAT('SO-', LPAD(so.id, 4, '0')))
      END as so_number,
      c.company_name as customer_name,
      con.email as customer_email,
      COALESCE(ba.bank_name, cp.manual_bank_account) as bank_name,
      ba.account_number,
      cp_pos.po_number as customer_po_number,
      COALESCE(
        (SELECT GROUP_CONCAT(DISTINCT cpa.reference_no ORDER BY cpa.id SEPARATOR ', ') 
         FROM customer_payment_allocations cpa 
         WHERE cpa.customer_payment_id = cp.id),
        si.invoice_no
      ) as invoice_no
    FROM customer_payments cp
    LEFT JOIN sales_invoices si ON (cp.invoice_id = si.id OR (cp.sales_order_id = si.id AND cp.sales_order_source = 'SALES_INVOICE'))
    LEFT JOIN sales_orders so ON cp.sales_order_id = so.id AND cp.sales_order_source = 'SALES_ORDER'
    LEFT JOIN customer_pos cp_pos ON so.customer_po_id = cp_pos.id
    LEFT JOIN orders o ON (cp.sales_order_id = o.id AND cp.sales_order_source = 'DIRECT_ORDER') OR si.order_id = o.id
    LEFT JOIN companies c ON cp.customer_id = c.id
    LEFT JOIN contacts con ON con.company_id = c.id AND con.contact_type = 'PRIMARY'
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

  if (filters.invoiceId) {
    query += ' AND (cp.invoice_id = ? OR (cp.sales_order_id = ? AND cp.sales_order_source = \'SALES_INVOICE\'))';
    params.push(filters.invoiceId, filters.invoiceId);
  } else if (filters.salesOrderId) {
    query += ' AND cp.sales_order_id = ?';
    params.push(filters.salesOrderId);
  }

  if (filters.salesOrderSource) {
    query += ' AND cp.sales_order_source = ?';
    params.push(filters.salesOrderSource);
  }

  query += ' ORDER BY cp.created_at DESC, cp.id DESC';

  const [payments] = await pool.query(query, params);
  return payments;
};

const getPaymentReceivedById = async (paymentId) => {
  const [rows] = await pool.query(
    `SELECT 
      cp.*,
      CASE 
        WHEN cp.sales_order_source = 'DIRECT_ORDER' THEN o.order_no
        ELSE COALESCE(so.so_number, CONCAT('SO-', LPAD(so.id, 4, '0')))
      END as so_number,
      CASE
        WHEN cp.sales_order_source = 'DIRECT_ORDER' THEN o.project_name
        ELSE COALESCE(so.project_name, cp_pos.project_name)
      END as project_name,
      c.company_name as customer_name,
      c.gstin,
      con.name as contact_person,
      con.phone as customer_phone,
      COALESCE(ba.bank_name, cp.manual_bank_account) as bank_name,
      ba.account_number,
      cp.manual_bank_account,
      u.first_name as paid_by_first,
      u.last_name as paid_by_last,
      CONCAT(u.first_name, ' ', u.last_name) as paid_by,
      r.name as created_by_role
    FROM customer_payments cp
    LEFT JOIN sales_orders so ON cp.sales_order_id = so.id AND cp.sales_order_source = 'SALES_ORDER'
    LEFT JOIN customer_pos cp_pos ON so.customer_po_id = cp_pos.id
    LEFT JOIN orders o ON cp.sales_order_id = o.id AND cp.sales_order_source = 'DIRECT_ORDER'
    LEFT JOIN companies c ON cp.customer_id = c.id
    LEFT JOIN contacts con ON con.company_id = c.id AND con.contact_type = 'PRIMARY'
    LEFT JOIN bank_accounts ba ON cp.bank_account_id = ba.id
    LEFT JOIN users u ON cp.created_by = u.id
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE cp.id = ?`,
    [paymentId]
  );

  if (!rows.length) {
    const error = new Error('Payment not found');
    error.statusCode = 404;
    throw error;
  }

  const payment = rows[0];

  // Fetch items based on source
  let items = [];
  if (payment.sales_order_id) {
    if (payment.sales_order_source === 'DIRECT_ORDER') {
      const [orderItems] = await pool.query(
        `SELECT 
          item_code,
          description,
          quantity,
          rate as unit_rate,
          amount
        FROM order_items 
        WHERE order_id = ?`,
        [payment.sales_order_id]
      );
      items = orderItems;
    } else {
      // SALES_ORDER
      const [soItems] = await pool.query(
        `SELECT 
          item_code,
          description,
          quantity,
          rate as unit_rate,
          (quantity * rate) as amount,
          tax_value as cgst_amount -- Approximate mapping if detailed tax not available
        FROM sales_order_items 
        WHERE sales_order_id = ?`,
        [payment.sales_order_id]
      );
      items = soItems;
    }
  }

  payment.items = items;
  return payment;
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

const getCustomerMonthlySummary = async (customerId, yearInput, monthInput, customStartDate, customEndDate) => {
  const now = new Date();
  let startDate, endDate, monthName, year, month;

  if (customStartDate && customEndDate) {
    startDate = `${customStartDate.slice(0, 10)} 00:00:00`;
    endDate = `${customEndDate.slice(0, 10)} 23:59:59`;
    const dStart = new Date(customStartDate);
    year = dStart.getFullYear();
    month = dStart.getMonth() + 1;
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    monthName = (customStartDate.slice(0, 7) === customEndDate.slice(0, 7))
      ? `${monthNames[month - 1]} ${year}`
      : `${customStartDate} to ${customEndDate}`;
  } else {
    year = parseInt(yearInput, 10) || now.getFullYear();
    month = parseInt(monthInput, 10) || (now.getMonth() + 1); // 1-12

    const pad = (n) => String(n).padStart(2, '0');
    startDate = `${year}-${pad(month)}-01 00:00:00`;
    const lastDay = new Date(year, month, 0).getDate();
    endDate = `${year}-${pad(month)}-${pad(lastDay)} 23:59:59`;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    monthName = `${monthNames[month - 1]} ${year}`;
  }

  // 1. Prior Invoices (before current month)
  const [priorInvRows] = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0) as total
     FROM sales_invoices
     WHERE client_id = ? AND sent_to_accounts = 1 AND status != 'Cancelled'
       AND COALESCE(invoice_date, created_at) < ?`,
    [customerId, startDate]
  );
  const priorInvoiced = parseFloat(priorInvRows[0]?.total || 0);

  // 2. Prior Payments (before current month)
  const [priorPayRows] = await pool.query(
    `SELECT COALESCE(SUM(payment_amount), 0) as total
     FROM customer_payments
     WHERE customer_id = ? AND status = 'CONFIRMED'
       AND payment_date < ?`,
    [customerId, startDate]
  );
  const priorPaid = parseFloat(priorPayRows[0]?.total || 0);

  const openingBalance = Math.max(0, priorInvoiced - priorPaid);

  // 3. Current Month Invoices
  const [curInvRows] = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0) as total
     FROM sales_invoices
     WHERE client_id = ? AND sent_to_accounts = 1 AND status != 'Cancelled'
       AND COALESCE(invoice_date, created_at) >= ?
       AND COALESCE(invoice_date, created_at) <= ?`,
    [customerId, startDate, endDate]
  );
  const currentMonthInvoices = parseFloat(curInvRows[0]?.total || 0);

  // 4. Current Month Payments
  const [curPayRows] = await pool.query(
    `SELECT COALESCE(SUM(payment_amount), 0) as total
     FROM customer_payments
     WHERE customer_id = ? AND status = 'CONFIRMED'
       AND payment_date >= ?
       AND payment_date <= ?`,
    [customerId, startDate, endDate]
  );
  const currentMonthPayments = parseFloat(curPayRows[0]?.total || 0);

  // 5. Closing Balance: Opening + Invoiced - Paid
  const closingBalance = Math.max(0, openingBalance + currentMonthInvoices - currentMonthPayments);

  return {
    customerId: Number(customerId),
    year,
    month,
    monthName,
    startDate: startDate.split(' ')[0],
    endDate: endDate.split(' ')[0],
    openingBalance,
    currentMonthInvoices,
    currentMonthPayments,
    currentBalance: closingBalance,
    closingBalance
  };
};

const getOutstandingInvoices = async (customerId) => {
  const [invoices] = await pool.query(
    `SELECT 
      si.id as id,
      si.id as invoice_id,
      si.order_id as sales_order_id,
      si.client_id as company_id,
      CONVERT(si.invoice_no USING utf8mb4) as invoice_no,
      CONVERT(COALESCE(o.order_no, CONCAT('ORD-', si.order_id)) USING utf8mb4) as so_number,
      CONVERT(COALESCE(si.customer_po_no, cp.po_number, '') USING utf8mb4) as customer_po_no,
      c.company_name as company_name,
      COALESCE(NULLIF(si.project_name, ''), NULLIF(o.project_name, ''), 'General Project') as project_name,
      si.total_amount as total_amount,
      (COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa JOIN customer_payments cp ON cpa.customer_payment_id = cp.id WHERE cpa.invoice_id = si.id AND cp.status = 'CONFIRMED'), 0) +
       COALESCE((SELECT SUM(cp.payment_amount) FROM customer_payments cp WHERE (cp.invoice_id = si.id OR (cp.sales_order_id = si.id AND cp.sales_order_source = 'SALES_INVOICE')) AND cp.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM customer_payment_allocations cpa WHERE cpa.customer_payment_id = cp.id)), 0)) as paid_amount,
      (si.total_amount - COALESCE((SELECT SUM(cn.total_amount) FROM credit_notes cn WHERE cn.sales_invoice_id = si.id AND cn.status = 'POSTED'), 0) - (COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa JOIN customer_payments cp ON cpa.customer_payment_id = cp.id WHERE cpa.invoice_id = si.id AND cp.status = 'CONFIRMED'), 0) +
       COALESCE((SELECT SUM(cp.payment_amount) FROM customer_payments cp WHERE (cp.invoice_id = si.id OR (cp.sales_order_id = si.id AND cp.sales_order_source = 'SALES_INVOICE')) AND cp.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM customer_payment_allocations cpa WHERE cpa.customer_payment_id = cp.id)), 0))) as outstanding,
      CONVERT('SALES_INVOICE' USING utf8mb4) as source,
      si.created_at,
      si.invoice_date
    FROM sales_invoices si
    JOIN orders o ON o.id = si.order_id
    JOIN companies c ON si.client_id = c.id
    LEFT JOIN sales_orders so ON so.id = si.sales_order_id
    LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
    WHERE si.client_id = ? AND si.sent_to_accounts = 1 AND si.status != 'Cancelled'
    HAVING outstanding >= 0
    ORDER BY si.created_at DESC`,
    [customerId]
  );

  return invoices;
};

const getAllOutstandingInvoices = async () => {
  const [invoices] = await pool.query(
    `SELECT 
      si.id as id,
      si.id as invoice_id,
      si.order_id as sales_order_id,
      si.client_id as company_id,
      CONVERT(si.invoice_no USING utf8mb4) as invoice_no,
      CONVERT(COALESCE(o.order_no, CONCAT('ORD-', si.order_id)) USING utf8mb4) as so_number,
      CONVERT(COALESCE(si.customer_po_no, cp.po_number, '') USING utf8mb4) as customer_po_no,
      c.company_name as company_name,
      con.email as customer_email,
      COALESCE(NULLIF(si.project_name, ''), NULLIF(o.project_name, ''), 'General Project') as project_name,
      si.total_amount as total_amount,
      (COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa JOIN customer_payments cp ON cpa.customer_payment_id = cp.id WHERE cpa.invoice_id = si.id AND cp.status = 'CONFIRMED'), 0) +
       COALESCE((SELECT SUM(cp.payment_amount) FROM customer_payments cp WHERE (cp.invoice_id = si.id OR (cp.sales_order_id = si.id AND cp.sales_order_source = 'SALES_INVOICE')) AND cp.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM customer_payment_allocations cpa WHERE cpa.customer_payment_id = cp.id)), 0)) as paid_amount,
      (si.total_amount - COALESCE((SELECT SUM(cn.total_amount) FROM credit_notes cn WHERE cn.sales_invoice_id = si.id AND cn.status = 'POSTED'), 0) - (COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa JOIN customer_payments cp ON cpa.customer_payment_id = cp.id WHERE cpa.invoice_id = si.id AND cp.status = 'CONFIRMED'), 0) +
       COALESCE((SELECT SUM(cp.payment_amount) FROM customer_payments cp WHERE (cp.invoice_id = si.id OR (cp.sales_order_id = si.id AND cp.sales_order_source = 'SALES_INVOICE')) AND cp.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM customer_payment_allocations cpa WHERE cpa.customer_payment_id = cp.id)), 0))) as outstanding,
      CONVERT('SALES_INVOICE' USING utf8mb4) as source,
      si.created_at,
      si.invoice_date
    FROM sales_invoices si
    JOIN orders o ON o.id = si.order_id
    JOIN companies c ON si.client_id = c.id
    LEFT JOIN sales_orders so ON so.id = si.sales_order_id
    LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
    LEFT JOIN contacts con ON con.company_id = c.id AND con.contact_type = 'PRIMARY'
    WHERE si.sent_to_accounts = 1 AND si.status != 'Cancelled'
    HAVING outstanding >= 0
    ORDER BY si.created_at DESC`
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
    `SELECT 
      c.*,
      ct.email as contact_email,
      ct.phone as contact_phone,
      (SELECT CONCAT_WS(', ', line1, line2, city, state, pincode) FROM company_addresses WHERE company_id = c.id AND address_type = 'SHIPPING' LIMIT 1) as shipping_address
    FROM companies c
    LEFT JOIN (
      SELECT company_id, email, phone,
             ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY contact_type = 'PRIMARY' DESC, id ASC) as rn
      FROM contacts
    ) ct ON ct.company_id = c.id AND ct.rn = 1
    WHERE c.id = ?`,
    [payment.customer_id]
  );
  const customer = customerRows[0];

  // Fetch items based on source
  let items = [];
  let subtotal = 0;
  let gst = 0;
  let grand_total = 0;

  if (payment.sales_order_id) {
    if (payment.sales_order_source === 'DIRECT_ORDER') {
      const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ?', [payment.sales_order_id]);
      if (orderRows.length > 0) {
        const order = orderRows[0];
        subtotal = order.subtotal;
        gst = order.gst;
        grand_total = order.grand_total;
        const [itemRows] = await pool.query('SELECT description, quantity, type as unit, rate, amount FROM order_items WHERE order_id = ?', [payment.sales_order_id]);
        items = itemRows;
      }
    } else {
      const [soRows] = await pool.query('SELECT * FROM sales_orders WHERE id = ?', [payment.sales_order_id]);
      if (soRows.length > 0) {
        const so = soRows[0];
        const [itemRows] = await pool.query('SELECT description, quantity, unit, rate, tax_value FROM sales_order_items WHERE sales_order_id = ?', [payment.sales_order_id]);
        items = itemRows.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
          rate: i.rate,
          amount: (i.quantity * i.rate) + i.tax_value
        }));
        subtotal = itemRows.reduce((sum, i) => sum + (i.quantity * i.rate), 0);
        gst = itemRows.reduce((sum, i) => sum + i.tax_value, 0);
        grand_total = subtotal + gst;
      }
    }
  }

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.4; margin: 20px; font-size: 11px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-bottom: 20px; }
        .company-info h1 { color: #065f46; margin: 0; font-size: 18px; }
        .company-info p { margin: 2px 0; color: #6b7280; font-size: 10px; }
        .receipt-title { text-align: right; }
        .receipt-title h2 { margin: 0; color: #10b981; font-size: 16px; text-transform: uppercase; }
        
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .section-label { font-weight: 700; color: #6b7280; font-size: 9px; margin-bottom: 5px; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; }
        
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th { background: #f9fafb; color: #374151; text-align: left; padding: 6px 8px; font-weight: 700; border-bottom: 1px solid #e5e7eb; }
        .items-table td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
        .text-right { text-align: right; }
        
        .summary-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 30px; }
        .payment-info { background: #f0fdf4; padding: 12px; border-radius: 6px; border: 1px solid #dcfce7; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px; }
        .info-label { color: #065f46; font-weight: 500; }
        .info-value { font-weight: 700; color: #064e3b; }
        
        .totals { text-align: right; }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 10px; }
        .grand-total { border-top: 1px solid #10b981; margin-top: 4px; padding-top: 4px; font-size: 14px; font-weight: 800; color: #065f46; }
        
        .footer { margin-top: 30px; text-align: center; color: #9ca3af; font-size: 8px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
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
          <p><strong>No:</strong> {{payment_receipt_no}}<br>
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
          <p><strong>Order No:</strong> {{so_number}}<br>
          <strong>Status:</strong> {{status}}</p>
        </div>
      </div>

      <div class="section-label">Order Items</div>
      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Rate</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {{#items}}
          <tr>
            <td>{{description}}</td>
            <td class="text-right">{{quantity}} {{unit}}</td>
            <td class="text-right">₹{{rate}}</td>
            <td class="text-right">₹{{amount}}</td>
          </tr>
          {{/items}}
        </tbody>
      </table>

      <div class="summary-grid">
        <div class="payment-info">
          <div class="section-label" style="color: #059669; border-color: #a7f3d0; margin-bottom: 8px;">Transaction Details</div>
          <div class="info-row">
            <span class="info-label">Payment Mode</span>
            <span class="info-value">{{payment_mode}}</span>
          </div>
          {{#transaction_ref_no}}
          <div class="info-row">
            <span class="info-label">Ref No</span>
            <span class="info-value">{{transaction_ref_no}}</span>
          </div>
          {{/transaction_ref_no}}
          {{#bank_name}}
          <div class="info-row">
            <span class="info-label">Bank Info</span>
            <span class="info-value">{{bank_name}}</span>
          </div>
          {{/bank_name}}
          <div class="info-row" style="margin-top: 8px; border-top: 1px dashed #a7f3d0; padding-top: 5px;">
            <span class="info-label">Amount Paid</span>
            <span class="info-value" style="font-size: 13px;">₹{{formatted_amount}}</span>
          </div>
        </div>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>₹{{formatted_subtotal}}</span>
          </div>
          <div class="total-row">
            <span>GST:</span>
            <span>₹{{formatted_gst}}</span>
          </div>
          <div class="total-row grand-total">
            <span>Total:</span>
            <span>₹{{formatted_grand_total}}</span>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>This is a computer-generated payment receipt and does not require a physical signature.<br>
        SPTECHPIONEER PVT LTD | Confidential | Generated on {{current_timestamp}}</p>
      </div>
    </body>
    </html>
  `;

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const viewData = {
    ...payment,
    customer_name: customer?.company_name || 'N/A',
    email: customer?.contact_email || 'N/A',
    location: customer?.shipping_address || 'N/A',
    phone: customer?.contact_phone || 'N/A',
    formatted_date: formatDate(payment.payment_date),
    formatted_cheque_date: formatDate(payment.cheque_date),
    formatted_amount: parseFloat(payment.payment_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    formatted_subtotal: subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    formatted_gst: gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    formatted_grand_total: grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    remarks: payment.remarks || '—',
    so_number: payment.so_number || 'Advance Payment',
    current_timestamp: new Date().toLocaleString('en-IN'),
    items: items.map(i => ({
      ...i,
      rate: parseFloat(i.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      amount: parseFloat(i.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    }))
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
    `SELECT c.company_name, con.email 
     FROM companies c 
     LEFT JOIN contacts con ON con.company_id = c.id AND con.contact_type = 'PRIMARY'
     WHERE c.id = ?`,
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

const sendCustomerInvoiceEmail = async (id, payload = {}) => {
  const { to, subject, message, attachPDF, source } = payload;

  let recipientEmail = to;
  let companyName = '';
  let soNumber = '';

  if (source === 'DIRECT_ORDER') {
    const [rows] = await pool.query(
      `SELECT o.order_no, c.company_name, con.email
       FROM orders o
       LEFT JOIN companies c ON o.client_id = c.id
       LEFT JOIN contacts con ON con.company_id = c.id AND con.contact_type = 'PRIMARY'
       WHERE o.id = ?`,
      [id]
    );
    if (rows.length > 0) {
      if (!recipientEmail) recipientEmail = rows[0].email;
      companyName = rows[0].company_name;
      soNumber = rows[0].order_no;
    }
  } else {
    // SALES_ORDER
    const [rows] = await pool.query(
      `SELECT so.id, COALESCE(so.so_number, CONCAT('SO-', LPAD(so.id, 4, '0'))) as so_number, c.company_name, con.email
       FROM sales_orders so
       LEFT JOIN companies c ON so.company_id = c.id
       LEFT JOIN contacts con ON con.company_id = c.id AND con.contact_type = 'PRIMARY'
       WHERE so.id = ?`,
      [id]
    );
    if (rows.length > 0) {
      if (!recipientEmail) recipientEmail = rows[0].email;
      companyName = rows[0].company_name;
      soNumber = rows[0].so_number;
    }
  }

  if (!recipientEmail) {
    throw new Error('Customer email address not found');
  }

  const finalSubject = subject || `Customer Invoice - ${soNumber}`;
  const finalMessage = message || `Dear ${companyName || 'Customer'},
  
Please find attached the customer invoice ${soNumber}.

Best Regards,
Accounts Department
SPTECHPIONEER PVT LTD`;

  const attachments = [];
  if (attachPDF !== false) {
    let pdfBuffer;
    if (source === 'DIRECT_ORDER') {
      const orderService = require('./orderService');
      pdfBuffer = await orderService.generateOrderPDF(id);
    } else {
      const salesOrderService = require('./salesOrderService');
      pdfBuffer = await salesOrderService.generateSalesOrderPDF(id);
    }

    attachments.push({
      filename: `Invoice-${soNumber}.pdf`,
      content: pdfBuffer
    });
  }

  if (payload.customAttachments && Array.isArray(payload.customAttachments)) {
    for (const att of payload.customAttachments) {
      attachments.push({
        filename: att.filename,
        content: att.content,
        encoding: 'base64'
      });
    }
  }

  return await emailService.sendEmail(recipientEmail, finalSubject, finalMessage, attachments);
};

module.exports = {
  recordPaymentReceived,
  getPaymentsReceived,
  getPaymentReceivedById,
  getCustomerBalance,
  getCustomerMonthlySummary,
  getOutstandingInvoices,
  getAllOutstandingInvoices,
  updatePaymentStatus,
  deletePayment,
  generateCustomerPaymentReceiptPDF,
  sendCustomerPaymentReceiptEmail,
  sendCustomerInvoiceEmail
};
