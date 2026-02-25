const pool = require('../config/db');

const getDashboardStats = async () => {
  const [[poCounts]] = await pool.query(
    `SELECT
       SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) AS draftPos,
       SUM(CASE WHEN status = 'Approved ' THEN 1 ELSE 0 END) AS approvedPos
     FROM customer_pos`
  );

  const [[orderCounts]] = await pool.query(
    `SELECT
       SUM(CASE WHEN status = 'DESIGN' THEN 1 ELSE 0 END) AS designOrders,
       SUM(CASE WHEN status = 'PRODUCTION' THEN 1 ELSE 0 END) AS productionOrders,
       SUM(CASE WHEN status = 'DISPATCH_PENDING' THEN 1 ELSE 0 END) AS pendingDispatch,
       SUM(CASE WHEN status = 'PAYMENT_PENDING' THEN 1 ELSE 0 END) AS pendingPayment
     FROM sales_orders`
  );

  return {
    newPos: poCounts.draftPos || 0,
    approvedPos: poCounts.approvedPos || 0,
    designOrders: orderCounts.designOrders || 0,
    productionOrders: orderCounts.productionOrders || 0,
    pendingDispatch: orderCounts.pendingDispatch || 0,
    pendingPayment: orderCounts.pendingPayment || 0
  };
};

const getAccountsDashboardStats = async () => {
  // 1. KPI Stats
  const [[invoiceStats]] = await pool.query(`
    SELECT 
      COUNT(*) as totalInvoices,
      SUM(total_amount) as totalPayable,
      SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END) as paidAmount,
      SUM(CASE WHEN status != 'PAID' THEN total_amount ELSE 0 END) as pendingPayable,
      SUM(CASE WHEN status != 'PAID' AND expected_delivery_date < CURRENT_DATE THEN 1 ELSE 0 END) as overdueCount
    FROM purchase_orders
    WHERE status NOT IN ('DRAFT', 'CANCELLED', 'PO_REQUEST')
  `);

  // 2. Monthly Cash Flow (Last 6 months)
  const [cashFlow] = await pool.query(`
    SELECT 
      DATE_FORMAT(month_list.month, '%b') as name,
      COALESCE(SUM(p.payment_amount), 0) as payments,
      COALESCE(SUM(cp.payment_amount), 0) as receipts
    FROM (
      SELECT CURRENT_DATE - INTERVAL 5 MONTH as month UNION 
      SELECT CURRENT_DATE - INTERVAL 4 MONTH UNION 
      SELECT CURRENT_DATE - INTERVAL 3 MONTH UNION 
      SELECT CURRENT_DATE - INTERVAL 2 MONTH UNION 
      SELECT CURRENT_DATE - INTERVAL 1 MONTH UNION 
      SELECT CURRENT_DATE
    ) month_list
    LEFT JOIN payments p ON DATE_FORMAT(p.payment_date, '%Y-%m') = DATE_FORMAT(month_list.month, '%Y-%m') AND p.status = 'CONFIRMED'
    LEFT JOIN customer_payments cp ON DATE_FORMAT(cp.payment_date, '%Y-%m') = DATE_FORMAT(month_list.month, '%Y-%m') AND cp.status = 'CONFIRMED'
    GROUP BY month_list.month
    ORDER BY month_list.month ASC
  `);

  // 3. Invoice Status Breakdown
  const [statusBreakdown] = await pool.query(`
    SELECT 
      status as name,
      COUNT(*) as count
    FROM purchase_orders
    WHERE status NOT IN ('DRAFT', 'CANCELLED', 'PO_REQUEST')
    GROUP BY status
  `);

  // 4. Vendor Wise Payable
  const [vendorPayables] = await pool.query(`
    SELECT 
      c.company_name as name,
      SUM(po.total_amount - COALESCE((SELECT SUM(payment_amount) FROM payments WHERE po_id = po.id AND status = 'CONFIRMED'), 0)) as amount
    FROM purchase_orders po
    JOIN companies c ON po.vendor_id = c.id
    WHERE po.status NOT IN ('DRAFT', 'CANCELLED', 'PAID', 'PO_REQUEST')
    GROUP BY c.id
    HAVING amount > 0
    ORDER BY amount DESC
    LIMIT 5
  `);

  // 5. Payment Mode Distribution
  const [paymentModes] = await pool.query(`
    SELECT 
      payment_mode as name,
      COUNT(*) as value
    FROM payments
    WHERE status = 'CONFIRMED'
    GROUP BY payment_mode
  `);

  // 6. Recent Activity (Combined Invoices and Payments)
  const [recentActivity] = await pool.query(`
    (SELECT 
      'INVOICE' as type,
      po_number as ref,
      status,
      total_amount as amount,
      (SELECT company_name FROM companies WHERE id = vendor_id) as vendor,
      created_at as time
    FROM purchase_orders
    ORDER BY created_at DESC LIMIT 5)
    UNION ALL
    (SELECT 
      'PAYMENT' as type,
      payment_voucher_no as ref,
      status,
      payment_amount as amount,
      (SELECT company_name FROM companies WHERE id = vendor_id) as vendor,
      created_at as time
    FROM payments
    ORDER BY created_at DESC LIMIT 5)
    ORDER BY time DESC
    LIMIT 10
  `);

  return {
    kpis: {
      totalInvoices: invoiceStats.totalInvoices || 0,
      totalPayable: invoiceStats.totalPayable || 0,
      paidAmount: invoiceStats.paidAmount || 0,
      pendingPayable: invoiceStats.pendingPayable || 0,
      overdueCount: invoiceStats.overdueCount || 0
    },
    cashFlow,
    statusBreakdown,
    vendorPayables,
    paymentModes,
    recentActivity
  };
};

module.exports = { getDashboardStats, getAccountsDashboardStats };
