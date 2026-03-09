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
      v.vendor_name as name,
      SUM(po.total_amount - COALESCE((SELECT SUM(payment_amount) FROM payments WHERE po_id = po.id AND status = 'CONFIRMED'), 0)) as amount
    FROM purchase_orders po
    JOIN vendors v ON po.vendor_id = v.id
    WHERE po.status NOT IN ('DRAFT', 'CANCELLED', 'PAID', 'PO_REQUEST')
    GROUP BY v.id
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
      (SELECT vendor_name FROM vendors WHERE id = vendor_id) as vendor,
      created_at as time
    FROM purchase_orders
    ORDER BY created_at DESC LIMIT 5)
    UNION ALL
    (SELECT 
      'PAYMENT' as type,
      payment_voucher_no as ref,
      status,
      payment_amount as amount,
      (SELECT vendor_name FROM vendors WHERE id = vendor_id) as vendor,
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

const getProcurementDashboardStats = async () => {
  const [[rfqStats]] = await pool.query(`
    SELECT 
      COUNT(*) as totalRfqs,
      SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as draftRfqs,
      SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sentRfqs
    FROM quotation_requests
  `);

  const [[poStats]] = await pool.query(`
    SELECT COUNT(*) as pendingPos FROM purchase_orders WHERE status = 'SENT'
  `);

  const [[mrStats]] = await pool.query(`
    SELECT COUNT(*) as mrCount FROM material_requests WHERE status = 'PENDING'
  `);

  const [recentRfqs] = await pool.query(`
    SELECT 
      rfq_code, 
      (SELECT vendor_name FROM vendors WHERE id = vendor_id) as vendor_name,
      (SELECT COUNT(*) FROM quotation_request_items WHERE rfq_id = qr.id) as item_count,
      status
    FROM quotation_requests qr
    ORDER BY created_at DESC LIMIT 5
  `);

  return {
    openRfqs: rfqStats.totalRfqs || 0,
    pendingPos: poStats.pendingPos || 0,
    materialRequests: mrStats.mrCount || 0,
    monthlySpend: 1250000, // Placeholder
    recentRfqs,
    chartData: [
      { name: 'Mon', spend: 4000 },
      { name: 'Tue', spend: 3000 },
      { name: 'Wed', spend: 2000 },
      { name: 'Thu', spend: 2780 },
      { name: 'Fri', spend: 1890 }
    ]
  };
};

const getProductionDashboardStats = async () => {
  const [[woStats]] = await pool.query(`
    SELECT 
      COUNT(*) as activeJobs,
      SUM(CASE WHEN status = 'COMPLETED' AND DATE(updated_at) = CURRENT_DATE THEN 1 ELSE 0 END) as completedToday
    FROM work_orders
    WHERE status != 'CANCELLED'
  `);

  const [[planStats]] = await pool.query(`
    SELECT COUNT(*) as plannedCount FROM production_plans WHERE status = 'PLANNED'
  `);

  const [priorityOrders] = await pool.query(`
    SELECT 
      wo_code, 
      (SELECT item_name FROM items_master WHERE id = item_id) as item_name,
      quantity,
      'NOS' as unit,
      status
    FROM work_orders
    WHERE status NOT IN ('COMPLETED', 'CANCELLED')
    ORDER BY created_at DESC LIMIT 5
  `);

  return {
    activeWorkOrders: woStats.activeJobs || 0,
    plannedOrders: planStats.plannedCount || 0,
    resourceLoad: 82,
    completedToday: woStats.completedToday || 0,
    priorityOrders,
    chartData: [
      { name: 'Mon', output: 2400 },
      { name: 'Tue', output: 1398 },
      { name: 'Wed', output: 9800 },
      { name: 'Thu', output: 3908 },
      { name: 'Fri', output: 4800 }
    ]
  };
};

const getDesignDashboardStats = async () => {
  const [[designStats]] = await pool.query(`
    SELECT 
      COUNT(*) as activeProjects,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedCount
    FROM design_orders
  `);

  const [[bomStats]] = await pool.query(`
    SELECT COUNT(*) as pendingBoms FROM bom WHERE status = 'DRAFT'
  `);

  const [pendingTasks] = await pool.query(`
    SELECT 
      'PRJ-' as project_code,
      (SELECT company_name FROM companies WHERE id = (SELECT company_id FROM sales_orders WHERE id = order_id)) as company_name,
      DATE_FORMAT(created_at, '%d %b') as deadline,
      status
    FROM design_orders
    WHERE status != 'COMPLETED'
    LIMIT 5
  `);

  return {
    activeProjects: designStats.activeProjects || 0,
    pendingBoms: bomStats.pendingBoms || 0,
    drawingReviews: 3,
    completedProjects: designStats.completedCount || 0,
    pendingTasks,
    chartData: [
      { name: 'Mon', releases: 4 },
      { name: 'Tue', releases: 3 },
      { name: 'Wed', releases: 2 },
      { name: 'Thu', releases: 6 },
      { name: 'Fri', releases: 8 }
    ]
  };
};

const getSalesDashboardStats = async () => {
  const [[salesStats]] = await pool.query(`
    SELECT 
      SUM(net_total) as totalRevenue,
      COUNT(*) as totalOrders
    FROM sales_orders
    WHERE status != 'CANCELLED'
  `);

  const [[quoteStats]] = await pool.query(`
    SELECT COUNT(*) as activeQuotes FROM quotations WHERE status = 'SENT'
  `);

  return {
    totalRevenue: salesStats.totalRevenue || 0,
    activeQuotes: quoteStats.activeQuotes || 0,
    newLeads: 24,
    winRate: 68,
    topOpportunities: [
      { client_name: 'Sidel India', value: 450000, age: 3, status: 'Negotiation' },
      { client_name: 'Bossar Packaging', value: 280000, age: 5, status: 'Review' }
    ],
    chartData: [
      { name: 'Mon', sales: 4000 },
      { name: 'Tue', sales: 3000 },
      { name: 'Wed', sales: 2000 },
      { name: 'Thu', sales: 2780 },
      { name: 'Fri', sales: 1890 }
    ]
  };
};

module.exports = { 
  getDashboardStats, 
  getAccountsDashboardStats,
  getProcurementDashboardStats,
  getProductionDashboardStats,
  getDesignDashboardStats,
  getSalesDashboardStats
};
