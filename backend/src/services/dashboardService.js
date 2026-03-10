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
       SUM(CASE WHEN status = 'PAYMENT_PENDING' THEN 1 ELSE 0 END) AS pendingPayment,
       COUNT(*) as totalOrders,
       COALESCE(SUM(net_total), 0) as totalRevenue
     FROM sales_orders
     WHERE status != 'CANCELLED'`
  );

  const [[userCount]] = await pool.query('SELECT COUNT(*) as total FROM users');

  const [chartData] = await pool.query(`
    SELECT 
      DATE_FORMAT(date_list.date, '%a') as name,
      COALESCE(SUM(so.net_total), 0) as sales,
      (SELECT COUNT(*) FROM work_orders WHERE DATE(created_at) = date_list.date) as production
    FROM (
      SELECT CURRENT_DATE - INTERVAL 6 DAY as date UNION 
      SELECT CURRENT_DATE - INTERVAL 5 DAY UNION 
      SELECT CURRENT_DATE - INTERVAL 4 DAY UNION 
      SELECT CURRENT_DATE - INTERVAL 3 DAY UNION 
      SELECT CURRENT_DATE - INTERVAL 2 DAY UNION 
      SELECT CURRENT_DATE - INTERVAL 1 DAY UNION 
      SELECT CURRENT_DATE
    ) date_list
    LEFT JOIN sales_orders so ON DATE(so.created_at) = date_list.date AND so.status != 'CANCELLED'
    GROUP BY date_list.date
    ORDER BY date_list.date ASC
  `);

  return {
    newPos: poCounts.draftPos || 0,
    approvedPos: poCounts.approvedPos || 0,
    designOrders: orderCounts.designOrders || 0,
    productionOrders: orderCounts.productionOrders || 0,
    pendingDispatch: orderCounts.pendingDispatch || 0,
    pendingPayment: orderCounts.pendingPayment || 0,
    totalRevenue: orderCounts.totalRevenue || 0,
    totalUsers: userCount.total || 0,
    chartData,
    health: [
      { label: 'Sales Fulfillment', value: 0, color: 'bg-indigo-500' },
      { label: 'Production Accuracy', value: 0, color: 'bg-emerald-500' },
      { label: 'Inventory Turnover', value: 0, color: 'bg-amber-500' },
      { label: 'Quality Acceptance', value: 0, color: 'bg-blue-500' }
    ]
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
    FROM procurement_rfqs
  `);

  const [[poStats]] = await pool.query(`
    SELECT 
      COUNT(*) as pendingPos,
      COALESCE(SUM(total_amount), 0) as monthlySpend
    FROM purchase_orders 
    WHERE status IN ('SENT', 'ORDERED', 'APPROVED') 
    AND created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
  `);

  const [[mrStats]] = await pool.query(`
    SELECT COUNT(DISTINCT id) as mrCount FROM material_requests WHERE status IN ('DRAFT', 'APPROVED', 'PROCESSING')
  `);

  const [recentRfqs] = await pool.query(`
    SELECT 
      rfq_number as rfq_code, 
      'Multiple Vendors' as vendor_name,
      (SELECT COUNT(*) FROM procurement_rfq_items WHERE rfq_id = pr.id) as item_count,
      status
    FROM procurement_rfqs pr
    ORDER BY created_at DESC LIMIT 5
  `);

  const [chartData] = await pool.query(`
    SELECT 
      DATE_FORMAT(date_list.date, '%b %d') as name,
      COALESCE(SUM(po.total_amount), 0) as spend
    FROM (
      SELECT CURRENT_DATE - INTERVAL 4 DAY as date UNION 
      SELECT CURRENT_DATE - INTERVAL 3 DAY UNION 
      SELECT CURRENT_DATE - INTERVAL 2 DAY UNION 
      SELECT CURRENT_DATE - INTERVAL 1 DAY UNION 
      SELECT CURRENT_DATE
    ) date_list
    LEFT JOIN purchase_orders po ON DATE(po.created_at) = date_list.date
    GROUP BY date_list.date
    ORDER BY date_list.date ASC
  `);

  const [categorySpend] = await pool.query(`
    SELECT 
      COALESCE(material_type, 'Uncategorized') as name,
      SUM(total_amount) as value
    FROM purchase_order_items
    GROUP BY material_type
    ORDER BY value DESC
  `);

  return {
    openRfqs: rfqStats.totalRfqs || 0,
    pendingPos: poStats.pendingPos || 0,
    materialRequests: mrStats.mrCount || 0,
    monthlySpend: poStats.monthlySpend || 0,
    recentRfqs,
    chartData,
    categorySpend: categorySpend.length > 0 ? categorySpend : [
      { name: 'Raw Materials', value: 0 },
      { name: 'Hardware', value: 0 },
      { name: 'Consumables', value: 0 }
    ],
    health: [
      { label: 'On-time Delivery', value: 0, color: 'bg-indigo-500' },
      { label: 'Quality Compliance', value: 0, color: 'bg-emerald-500' },
      { label: 'Cost Savings', value: 0, color: 'bg-amber-500' },
      { label: 'Lead Time', value: 0, color: 'bg-rose-500' }
    ]
  };
};

const getProductionDashboardStats = async () => {
  const [[woStats]] = await pool.query(`
    SELECT 
      COUNT(*) as activeJobs,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' AND DATE(updated_at) = CURRENT_DATE THEN 1 ELSE 0 END), 0) as completedToday
    FROM work_orders
    WHERE status NOT IN ('CANCELLED', 'COMPLETED')
  `);

  const [[planStats]] = await pool.query(`
    SELECT COUNT(*) as plannedCount FROM production_plans WHERE status = 'PLANNED'
  `);

  const [priorityOrders] = await pool.query(`
    SELECT 
      wo_number as wo_code, 
      item_name,
      quantity,
      'NOS' as unit,
      status
    FROM work_orders
    WHERE status NOT IN ('COMPLETED', 'CANCELLED')
    ORDER BY created_at DESC LIMIT 5
  `);

  const [chartData] = await pool.query(`
    SELECT 
      DATE_FORMAT(date_list.date, '%b %d') as name,
      COUNT(wo.id) as output
    FROM (
      SELECT CURRENT_DATE - INTERVAL 4 DAY as date UNION 
      SELECT CURRENT_DATE - INTERVAL 3 DAY UNION 
      SELECT CURRENT_DATE - INTERVAL 2 DAY UNION 
      SELECT CURRENT_DATE - INTERVAL 1 DAY UNION 
      SELECT CURRENT_DATE
    ) date_list
    LEFT JOIN work_orders wo ON DATE(wo.updated_at) = date_list.date AND wo.status = 'COMPLETED'
    GROUP BY date_list.date
    ORDER BY date_list.date ASC
  `);

  return {
    activeWorkOrders: woStats.activeJobs || 0,
    plannedOrders: planStats.plannedCount || 0,
    resourceLoad: 0,
    completedToday: woStats.completedToday || 0,
    priorityOrders,
    chartData,
    health: [
      { label: 'Schedule Adherence', value: 0, color: 'bg-indigo-500' },
      { label: 'Yield Quality', value: 0, color: 'bg-emerald-500' },
      { label: 'Downtime Variance', value: 0, color: 'bg-amber-500' },
      { label: 'Scrap Rate', value: 0, color: 'bg-rose-500' }
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
    SELECT COUNT(*) as pendingBoms FROM design_orders WHERE status = 'DRAFT'
  `);

  const [pendingTasks] = await pool.query(`
    SELECT 
      design_order_number as project_code,
      (SELECT company_name FROM companies WHERE id = (SELECT company_id FROM sales_orders WHERE id = sales_order_id)) as company_name,
      DATE_FORMAT(created_at, '%d %b') as deadline,
      status
    FROM design_orders
    WHERE status != 'COMPLETED'
    LIMIT 5
  `);

  const [chartData] = await pool.query(`
    SELECT 
      DATE_FORMAT(date_list.date, '%b %d') as name,
      COUNT(do.id) as releases
    FROM (
      SELECT CURRENT_DATE - INTERVAL 4 DAY as date UNION 
      SELECT CURRENT_DATE - INTERVAL 3 DAY UNION 
      SELECT CURRENT_DATE - INTERVAL 2 DAY UNION 
      SELECT CURRENT_DATE - INTERVAL 1 DAY UNION 
      SELECT CURRENT_DATE
    ) date_list
    LEFT JOIN design_orders do ON DATE(do.updated_at) = date_list.date AND do.status = 'COMPLETED'
    GROUP BY date_list.date
    ORDER BY date_list.date ASC
  `);

  return {
    activeProjects: designStats.activeProjects || 0,
    pendingBoms: bomStats.pendingBoms || 0,
    drawingReviews: 0,
    completedProjects: designStats.completedCount || 0,
    pendingTasks,
    chartData,
    health: [
      { label: 'BOM Accuracy', value: 0, color: 'bg-indigo-500' },
      { label: 'Timeline Adherence', value: 0, color: 'bg-emerald-500' },
      { label: 'Revision Rate', value: 0, color: 'bg-amber-500' },
      { label: 'Technical Compliance', value: 0, color: 'bg-rose-500' }
    ]
  };
};

const getSalesDashboardStats = async () => {
  const [[salesStats]] = await pool.query(`
    SELECT 
      COALESCE(SUM(net_total), 0) as totalRevenue,
      COUNT(*) as totalOrders
    FROM sales_orders
    WHERE status != 'CANCELLED'
  `);

  const [[quoteStats]] = await pool.query(`
    SELECT COUNT(*) as activeQuotes FROM quotations WHERE status = 'SENT'
  `);

  const [chartData] = await pool.query(`
    SELECT 
      DATE_FORMAT(date_list.date, '%b %d') as name,
      COALESCE(SUM(so.net_total), 0) as sales
    FROM (
      SELECT CURRENT_DATE - INTERVAL 4 DAY as date UNION 
      SELECT CURRENT_DATE - INTERVAL 3 DAY UNION 
      SELECT CURRENT_DATE - INTERVAL 2 DAY UNION 
      SELECT CURRENT_DATE - INTERVAL 1 DAY UNION 
      SELECT CURRENT_DATE
    ) date_list
    LEFT JOIN sales_orders so ON DATE(so.created_at) = date_list.date AND so.status != 'CANCELLED'
    GROUP BY date_list.date
    ORDER BY date_list.date ASC
  `);

  return {
    totalRevenue: salesStats.totalRevenue || 0,
    activeQuotes: quoteStats.activeQuotes || 0,
    newLeads: 0,
    winRate: 0,
    topOpportunities: [],
    chartData,
    health: [
      { label: 'Quote fulfillment', value: 0, color: 'bg-indigo-500' },
      { label: 'Customer Retention', value: 0, color: 'bg-emerald-500' },
      { label: 'Market Penetration', value: 0, color: 'bg-amber-500' },
      { label: 'Lead Velocity', value: 0, color: 'bg-blue-500' }
    ]
  };
};

const getShipmentDashboardStats = async () => {
  const [[shipmentStats]] = await pool.query(`
    SELECT 
      SUM(CASE WHEN status NOT IN ('DELIVERED', 'CANCELLED') THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN (status = 'IN_TRANSIT' OR status = 'DELAYED') AND estimated_delivery_date < CURRENT_DATE THEN 1 ELSE 0 END) as \`delayed\`,
      COUNT(*) as total
    FROM shipment_orders
  `);

  const [recentShipments] = await pool.query(`
    SELECT 
      shipment_code,
      (SELECT company_name FROM companies WHERE id = (SELECT company_id FROM sales_orders WHERE id = sales_order_id)) as customer_name,
      status,
      updated_at
    FROM shipment_orders
    ORDER BY updated_at DESC LIMIT 4
  `);

  const [monthlyData] = await pool.query(`
    SELECT 
      DATE_FORMAT(month_list.month, '%b') as month,
      COUNT(so.id) as ordered,
      SUM(CASE WHEN so.status = 'DISPATCHED' THEN 1 ELSE 0 END) as dispatched,
      SUM(CASE WHEN so.status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN so.status = 'DELAYED' THEN 1 ELSE 0 END) as delayed
    FROM (
      SELECT CURRENT_DATE - INTERVAL 2 MONTH as month UNION 
      SELECT CURRENT_DATE - INTERVAL 1 MONTH UNION 
      SELECT CURRENT_DATE
    ) month_list
    LEFT JOIN shipment_orders so ON DATE_FORMAT(so.created_at, '%Y-%m') = DATE_FORMAT(month_list.month, '%Y-%m')
    GROUP BY month_list.month
    ORDER BY month_list.month ASC
  `);

  return {
    stats: {
      active: shipmentStats.active || 0,
      delivered: shipmentStats.delivered || 0,
      delayed: shipmentStats.delayed || 0,
      returns: 0,
      dispatched: shipmentStats.delivered || 0,
      total: shipmentStats.total || 0,
      sla: 0,
      health: [
        { label: 'Active', value: 0, color: '#4f46e5' },
        { label: 'Delivered', value: 0, color: '#10b981' },
        { label: 'Delayed', value: 0, color: '#ef4444' },
        { label: 'Returns', value: 0, color: '#f59e0b' }
      ]
    },
    monthlyData,
    recentShipments
  };
};

module.exports = { 
  getDashboardStats, 
  getAccountsDashboardStats,
  getProcurementDashboardStats,
  getProductionDashboardStats,
  getDesignDashboardStats,
  getSalesDashboardStats,
  getShipmentDashboardStats
};
