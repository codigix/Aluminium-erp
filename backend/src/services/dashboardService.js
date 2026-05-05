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

const getSalesDashboardStats = async (filters = {}) => {
  const { start, end, customer } = filters;
  let dateFilter = '';
  let params = [];

  if (start && end) {
    dateFilter = ' AND DATE(created_at) BETWEEN ? AND ?';
    params = [start, end];
  }

  let customerFilter = '';
  if (customer && customer !== 'All') {
    customerFilter = ' AND c.company_name = ?';
  }

  // 1. Quotation Activity (KPIs)
  const [[quoteStats]] = await pool.query(`
    SELECT 
      COUNT(*) as totalQuotes,
      SUM(CASE WHEN qr.status IN ('SENT', 'RECEIVED') THEN 1 ELSE 0 END) as sentQuotes,
      SUM(CASE WHEN qr.status IN ('Approved', 'Approved ', 'COMPLETED', 'Completed', 'ACCEPTED', 'Accepted') THEN 1 ELSE 0 END) as approvedQuotes,
      SUM(CASE WHEN qr.status = 'REJECTED' THEN 1 ELSE 0 END) as rejectedQuotes
    FROM quotation_requests qr
    JOIN companies c ON qr.company_id = c.id
    WHERE (qr.parent_id IS NULL OR qr.parent_id = 0)
    ${dateFilter.replace('created_at', 'qr.created_at')}
    ${customerFilter}
  `, [...params, ...(customer && customer !== 'All' ? [customer] : [])]);

  // 2. Converted Orders
  const [[orderStats]] = await pool.query(`
    SELECT COUNT(*) as convertedOrders 
    FROM orders o
    JOIN companies c ON o.client_id = c.id
    WHERE o.status != 'CANCELLED'
    ${dateFilter.replace('created_at', 'o.created_at')}
    ${customerFilter}
  `, [...params, ...(customer && customer !== 'All' ? [customer] : [])]);

  const conversionRate = quoteStats.totalQuotes > 0 
    ? Math.round((orderStats.convertedOrders / quoteStats.totalQuotes) * 100) 
    : 0;

  // 3. Sales Trend
  const [chartData] = await pool.query(`
    SELECT 
      DATE_FORMAT(date_list.date, '%d %b') as name,
      COALESCE(SUM(o.grand_total), 0) as value
    FROM (
      SELECT CURRENT_DATE - INTERVAL 29 DAY as date UNION ALL
      SELECT CURRENT_DATE - INTERVAL 28 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 27 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 26 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 25 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 24 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 23 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 22 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 21 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 20 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 19 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 18 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 17 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 16 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 15 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 14 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 13 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 12 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 11 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 10 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 9 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 8 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 7 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 6 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 5 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 4 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 3 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 2 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 1 DAY UNION ALL
      SELECT CURRENT_DATE
    ) date_list
    LEFT JOIN orders o ON DATE(o.created_at) = date_list.date AND o.status != 'CANCELLED'
    LEFT JOIN companies c ON o.client_id = c.id
    WHERE 1=1 ${customerFilter}
    GROUP BY date_list.date
    ORDER BY date_list.date ASC
  `, customer && customer !== 'All' ? [customer] : []);

  // 4. Funnel Data
  const funnelData = [
    { name: 'Total Quotations', value: quoteStats.totalQuotes || 0, color: '#6366f1' },
    { name: 'Sent Quotations', value: quoteStats.sentQuotes || 0, color: '#3b82f6' },
    { name: 'Approved Quotations', value: quoteStats.approvedQuotes || 0, color: '#10b981' },
    { name: 'Converted Orders', value: orderStats.convertedOrders || 0, color: '#f43f5e' }
  ];

  // 5. Recent Activity
  const [recentActivity] = await pool.query(`
    (SELECT 
      'QUOTE_APPROVED' as type,
      CONCAT('QRT-', LPAD(qr.id, 4, '0')) as ref,
      'Approved' as status,
      c.company_name as customer,
      qr.created_at as time
    FROM quotation_requests qr
    JOIN companies c ON c.id = qr.company_id
    WHERE qr.status IN ('Approved', 'Approved ', 'COMPLETED', 'Completed')
    ${customerFilter}
    ORDER BY qr.created_at DESC LIMIT 3)
    UNION ALL
    (SELECT 
      'ORDER_CREATED' as type,
      order_no as ref,
      'Created' as status,
      c.company_name as customer,
      o.created_at as time
    FROM orders o
    JOIN companies c ON c.id = o.client_id
    WHERE 1=1 ${customerFilter}
    ORDER BY o.created_at DESC LIMIT 2)
    ORDER BY time DESC LIMIT 5
  `, [...(customer && customer !== 'All' ? [customer, customer] : [])]);

  // 6. Approved Quotations Table
  const [approvedQuotes] = await pool.query(`
    SELECT 
      CONCAT('QRT-', LPAD(qr.id, 4, '0')) as id,
      c.company_name as customer,
      qr.total_amount as amount,
      DATE_FORMAT(qr.created_at, '%d %b %Y') as date
    FROM quotation_requests qr
    JOIN companies c ON qr.company_id = c.id
    WHERE qr.status IN ('Approved', 'Approved ', 'COMPLETED', 'Completed')
    ${dateFilter.replace('created_at', 'qr.created_at')}
    ${customerFilter}
    ORDER BY qr.created_at DESC LIMIT 50
  `, [...params, ...(customer && customer !== 'All' ? [customer] : [])]);

  // 7. Active Clients
  const [activeClients] = await pool.query(`
    SELECT 
      c.id,
      c.company_name as name,
      LEFT(c.company_name, 2) as initials,
      c.company_code as sub,
      COUNT(o.id) as orders,
      SUM(o.grand_total) as value,
      DATE_FORMAT(MAX(o.created_at), '%d %b %Y') as lastDate
    FROM companies c
    JOIN orders o ON c.id = o.client_id
    WHERE o.status != 'CANCELLED'
    ${dateFilter.replace('created_at', 'o.created_at')}
    GROUP BY c.id
    ORDER BY value DESC LIMIT 50
  `, params);

  // 8. Sales Orders Detailed Table
  const [salesOrders] = await pool.query(`
    SELECT 
      o.id as id_val,
      o.order_no as id,
      c.company_name as customer,
      LEFT(c.company_name, 2) as initials,
      c.company_code as sub,
      DATE_FORMAT(o.created_at, '%d %b %Y') as date,
      DATE_FORMAT(o.delivery_date, '%d %b %Y') as delivery,
      o.grand_total as total,
      o.status
    FROM orders o
    JOIN companies c ON o.client_id = c.id
    WHERE o.status != 'CANCELLED'
    ${dateFilter.replace('created_at', 'o.created_at')}
    ${customerFilter}
    ORDER BY o.created_at DESC LIMIT 50
  `, [...params, ...(customer && customer !== 'All' ? [customer] : [])]);

  return {
    kpis: {
      totalQuotes: quoteStats.totalQuotes || 0,
      sentQuotes: quoteStats.sentQuotes || 0,
      approvedQuotes: quoteStats.approvedQuotes || 0,
      rejectedQuotes: quoteStats.rejectedQuotes || 0,
      conversionRate
    },
    chartData,
    funnelData,
    recentActivity,
    approvedQuotes,
    activeClients,
    salesOrders
  };
};

const getShipmentDashboardStats = async () => {
  const [shipmentRows] = await pool.query(`
    SELECT 
      SUM(CASE WHEN status NOT IN ('DELIVERED', 'CANCELLED') THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN (status = 'IN_TRANSIT' OR status = 'DELAYED') AND estimated_delivery_date < CURRENT_DATE THEN 1 ELSE 0 END) as is_delayed,
      COUNT(*) as total
    FROM shipment_orders
  `);
  
  const shipmentStats = shipmentRows[0] || {};

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
      SUM(CASE WHEN so.status = 'DELAYED' THEN 1 ELSE 0 END) as is_delayed
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
      delayed: shipmentStats.is_delayed || 0,
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
    monthlyData: monthlyData.map(d => ({
      ...d,
      delayed: d.is_delayed || 0
    })),
    recentShipments
  };
};

const getProcurementReportStats = async () => {
  // 1. KPI Stats
  const [[rfqStats]] = await pool.query(`
    SELECT 
      COUNT(*) as totalRfqs,
      SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sentRfqs,
      SUM(CASE WHEN status = 'RECEIVED' THEN 1 ELSE 0 END) as receivedRfqs
    FROM procurement_rfqs
  `);

  const [[poStats]] = await pool.query(`
    SELECT 
      COUNT(*) as totalPos,
      SUM(CASE WHEN status IN ('COMPLETED', 'FULFILLED', 'PAID') THEN 1 ELSE 0 END) as completedOrders,
      SUM(CASE WHEN status NOT IN ('COMPLETED', 'FULFILLED', 'PAID', 'DRAFT') THEN 1 ELSE 0 END) as pendingOrders
    FROM purchase_orders
    WHERE status != 'DRAFT'
  `);

  // 2. Funnel Data
  const [[grnStats]] = await pool.query(`SELECT COUNT(*) as completedGrns FROM grns WHERE status = 'APPROVED'`);
  
  const funnelData = [
    { name: 'RFQ Created', value: rfqStats.totalRfqs || 0, color: '#6366f1' },
    { name: 'RFQ Sent', value: rfqStats.sentRfqs || 0, color: '#3b82f6' },
    { name: 'Quotes Received', value: rfqStats.receivedRfqs || 0, color: '#10b981' },
    { name: 'PO Created', value: poStats.totalPos || 0, color: '#f59e0b' },
    { name: 'GRN Completed', value: grnStats.completedGrns || 0, color: '#f43f5e' }
  ];

  const conversionRate = rfqStats.totalRfqs > 0 
    ? ((grnStats.completedGrns / rfqStats.totalRfqs) * 100).toFixed(2) 
    : 0;

  // 3. Purchase Trend (Last 6 Months)
  const [purchaseTrend] = await pool.query(`
    SELECT 
      DATE_FORMAT(month_list.month, '%b %Y') as name,
      COALESCE(SUM(po.total_amount), 0) as value
    FROM (
      SELECT CURRENT_DATE - INTERVAL 5 MONTH as month UNION ALL
      SELECT CURRENT_DATE - INTERVAL 4 MONTH UNION ALL
      SELECT CURRENT_DATE - INTERVAL 3 MONTH UNION ALL
      SELECT CURRENT_DATE - INTERVAL 2 MONTH UNION ALL
      SELECT CURRENT_DATE - INTERVAL 1 MONTH UNION ALL
      SELECT CURRENT_DATE
    ) month_list
    LEFT JOIN purchase_orders po ON DATE_FORMAT(po.created_at, '%Y-%m') = DATE_FORMAT(month_list.month, '%Y-%m')
    GROUP BY month_list.month
    ORDER BY month_list.month ASC
  `);

  // 4. Vendor Performance
  const [vendorPerformance] = await pool.query(`
    SELECT 
      vendor_name as supplier,
      total_orders as totalOrders,
      '100%' as fulfillment,
      rating as avgRating,
      '0%' as delay
    FROM vendors
    WHERE status = 'ACTIVE'
    ORDER BY total_orders DESC LIMIT 5
  `);

  // 5. Recent Activity
  const [recentActivity] = await pool.query(`
    (SELECT 
      'RFQ_SENT' as type,
      rfq_number as ref,
      'Sent' as status,
      'General Procurement' as sub,
      created_at as time
    FROM procurement_rfqs WHERE status = 'SENT' LIMIT 2)
    UNION ALL
    (SELECT 
      'PO_CREATED' as type,
      po_number as ref,
      'Created' as status,
      (SELECT vendor_name FROM vendors WHERE id = vendor_id) as sub,
      created_at as time
    FROM purchase_orders LIMIT 2)
    UNION ALL
    (SELECT 
      'GRN_COMPLETED' as type,
      po_number as ref,
      'Completed' as status,
      (SELECT vendor_name FROM vendors WHERE id = (SELECT vendor_id FROM purchase_orders WHERE po_number = grns.po_number LIMIT 1)) as sub,
      created_at as time
    FROM grns WHERE status = 'APPROVED' LIMIT 1)
    ORDER BY time DESC LIMIT 5
  `);

  // 6. Summary Table
  const [summaryTable] = await pool.query(`
    SELECT 
      po.po_number as poNumber,
      v.vendor_name as supplier,
      COALESCE(so.project_name, 'General Procurement') as project,
      DATE_FORMAT(po.created_at, '%d %b %Y') as poDate,
      po.total_amount as poAmount,
      (SELECT status FROM grns WHERE po_number = po.po_number LIMIT 1) as grnStatus,
      po.status as status
    FROM purchase_orders po
    JOIN vendors v ON po.vendor_id = v.id
    LEFT JOIN sales_orders so ON po.sales_order_id = so.id
    ORDER BY po.created_at DESC LIMIT 10
  `);

  return {
    kpis: {
      totalRfqs: rfqStats.totalRfqs || 0,
      sentRfqs: rfqStats.sentRfqs || 0,
      receivedRfqs: rfqStats.receivedRfqs || 0,
      posCreated: poStats.totalPos || 0,
      completedOrders: poStats.completedOrders || 0,
      pendingOrders: poStats.pendingOrders || 0,
      conversionRate
    },
    funnelData,
    purchaseTrend,
    vendorPerformance,
    recentActivity,
    summaryTable
  };
};

const getProductionReportStats = async () => {
  // 1. KPI Stats
  const [[woStats]] = await pool.query(`
    SELECT 
      COUNT(*) as totalWorkOrders,
      SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
      COALESCE(SUM(quantity), 0) as plannedQty
    FROM work_orders
    WHERE status != 'CANCELLED'
  `);

  // Simple produced qty calculation (taking 100% of completed orders)
  const [[producedStats]] = await pool.query(`
    SELECT COALESCE(SUM(quantity), 0) as producedQty 
    FROM work_orders 
    WHERE status = 'COMPLETED'
  `);

  const totalWO = woStats.totalWorkOrders || 1;
  const inProgressPercent = Math.round(((woStats.inProgress || 0) / totalWO) * 100);
  const completedPercent = Math.round(((woStats.completed || 0) / totalWO) * 100);
  const efficiency = woStats.plannedQty > 0 
    ? Math.round((producedStats.producedQty / woStats.plannedQty) * 100) 
    : 0;

  // 2. Production Trend (Last 7 Days)
  const [productionTrend] = await pool.query(`
    SELECT 
      DATE_FORMAT(date_list.date, '%d %b') as name,
      COALESCE((SELECT SUM(quantity) FROM work_orders WHERE DATE(created_at) = date_list.date AND status != 'CANCELLED'), 0) as planned,
      COALESCE((SELECT SUM(quantity) FROM work_orders WHERE DATE(updated_at) = date_list.date AND status = 'COMPLETED'), 0) as produced
    FROM (
      SELECT CURRENT_DATE - INTERVAL 6 DAY as date UNION ALL
      SELECT CURRENT_DATE - INTERVAL 5 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 4 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 3 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 2 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 1 DAY UNION ALL
      SELECT CURRENT_DATE
    ) date_list
    GROUP BY date_list.date
    ORDER BY date_list.date ASC
  `);

  // 3. Work Order Status Distribution
  const [statusCounts] = await pool.query(`
    SELECT 
      status as name,
      COUNT(*) as value
    FROM work_orders
    WHERE status != 'CANCELLED'
    GROUP BY status
  `);

  const statusDistribution = statusCounts.map(s => ({
    name: s.name,
    value: s.value,
    percent: Math.round((s.value / totalWO) * 100)
  }));

  // 4. Operation Efficiency (Mock data as per requirements since specific operation tracking table is not fully defined in core summary)
  const operationEfficiency = [
    { name: 'Cutting', efficiency: 75 },
    { name: 'Deep Drawing', efficiency: 62 },
    { name: 'Trimming', efficiency: 58 },
    { name: 'Welding', efficiency: 66 },
    { name: 'Polishing', efficiency: 50 }
  ];

  // 5. Top Projects
  const [topProjects] = await pool.query(`
    SELECT 
      so.project_name as name,
      c.company_name as client,
      SUM(wo.quantity) as planned,
      SUM(CASE WHEN wo.status = 'COMPLETED' THEN wo.quantity ELSE 0 END) as produced
    FROM work_orders wo
    JOIN sales_orders so ON wo.sales_order_id = so.id
    JOIN companies c ON so.company_id = c.id
    GROUP BY so.id
    ORDER BY produced DESC
    LIMIT 3
  `);

  const topProjectsFormatted = topProjects.map(p => ({
    ...p,
    efficiency: p.planned > 0 ? Math.round((p.produced / p.planned) * 100) : 0
  }));

  // 6. Recent Activity
  const [recentActivity] = await pool.query(`
    SELECT 
      wo_number as wo,
      status as type,
      COALESCE((SELECT operation_name FROM operations WHERE workstation_id = work_orders.workstation_id LIMIT 1), 'General') as operation,
      updated_at as time
    FROM work_orders
    ORDER BY updated_at DESC
    LIMIT 4
  `);

  // 7. Summary Table
  const [summaryTable] = await pool.query(`
    SELECT 
      wo.wo_number as woNumber,
      so.project_name as project,
      c.company_name as client,
      COALESCE((SELECT operation_name FROM operations WHERE workstation_id = wo.workstation_id LIMIT 1), 'N/A') as operation,
      wo.item_code as itemCode,
      wo.item_name as itemName,
      wo.quantity as plannedQty,
      (CASE WHEN wo.status = 'COMPLETED' THEN wo.quantity ELSE 0 END) as producedQty,
      (CASE WHEN wo.status = 'COMPLETED' THEN 100 WHEN wo.status = 'IN_PROGRESS' THEN 50 ELSE 0 END) as progress,
      wo.status,
      wo.start_date as startDate,
      wo.end_date as dueDate
    FROM work_orders wo
    JOIN sales_orders so ON wo.sales_order_id = so.id
    JOIN companies c ON so.company_id = c.id
    ORDER BY wo.created_at DESC
    LIMIT 10
  `);

  return {
    kpis: {
      totalWorkOrders: woStats.totalWorkOrders || 0,
      inProgress: woStats.inProgress || 0,
      completed: woStats.completed || 0,
      plannedQty: parseFloat(woStats.plannedQty).toFixed(2),
      producedQty: parseFloat(producedStats.producedQty).toFixed(2),
      inProgressPercent,
      completedPercent,
      efficiency
    },
    productionTrend,
    statusDistribution,
    operationEfficiency,
    topProjects: topProjectsFormatted,
    recentActivity,
    summaryTable
  };
};

const getInventoryReportStats = async () => {
  // 1. KPI Stats
  const [[itemCount]] = await pool.query('SELECT COUNT(*) as total FROM items');
  const [[valueStats]] = await pool.query(`
    SELECT 
      COALESCE(SUM(current_balance * valuation_rate), 0) as totalValue,
      SUM(CASE WHEN current_balance > 0 AND current_balance < 10 THEN 1 ELSE 0 END) as lowStockCount,
      SUM(CASE WHEN current_balance <= 0 THEN 1 ELSE 0 END) as outOfStockCount
    FROM stock_balance
  `);
  const [[warehouseCount]] = await pool.query("SELECT COUNT(*) as total FROM warehouses WHERE status = 'ACTIVE'");

  // 2. Category Distribution
  const [categoryData] = await pool.query(`
    SELECT 
      COALESCE(material_type, 'Uncategorized') as name,
      SUM(current_balance * valuation_rate) as value
    FROM stock_balance
    GROUP BY material_type
    HAVING value > 0
    ORDER BY value DESC
  `);

  const totalVal = parseFloat(valueStats.totalValue) || 1;
  const categoryDistribution = categoryData.map(c => ({
    name: c.name,
    value: parseFloat(c.value).toFixed(2),
    percent: Math.round((parseFloat(c.value) / totalVal) * 100)
  }));

  // 3. Status Summary
  const [[statusStats]] = await pool.query(`
    SELECT 
      SUM(CASE WHEN current_balance >= 10 THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN current_balance > 0 AND current_balance < 10 THEN 1 ELSE 0 END) as lowStock,
      SUM(CASE WHEN current_balance <= 0 THEN 1 ELSE 0 END) as outOfStock
    FROM stock_balance
  `);

  const statusSummary = [
    { name: 'Available', value: statusStats.available || 0 },
    { name: 'Low Stock', value: statusStats.lowStock || 0 },
    { name: 'Out of Stock', value: statusStats.outOfStock || 0 }
  ];

  // 4. Stock Trend (Last 7 Days - mockup using ledger entries)
  const [stockTrend] = await pool.query(`
    SELECT 
      DATE_FORMAT(date_list.date, '%d %b') as name,
      COALESCE((SELECT SUM(balance_after * valuation_rate) FROM stock_ledger sl WHERE DATE(sl.transaction_date) <= date_list.date ORDER BY sl.transaction_date DESC LIMIT 1), 0) as value
    FROM (
      SELECT CURRENT_DATE - INTERVAL 6 DAY as date UNION ALL
      SELECT CURRENT_DATE - INTERVAL 5 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 4 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 3 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 2 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 1 DAY UNION ALL
      SELECT CURRENT_DATE
    ) date_list
    GROUP BY date_list.date
    ORDER BY date_list.date ASC
  `);

  // 5. Warehouse Stock
  const [warehouseStock] = await pool.query(`
    SELECT 
      warehouse as name,
      COUNT(*) as totalItems,
      SUM(current_balance * valuation_rate) as stockValue,
      SUM(CASE WHEN current_balance > 0 AND current_balance < 10 THEN 1 ELSE 0 END) as lowStock,
      SUM(CASE WHEN current_balance <= 0 THEN 1 ELSE 0 END) as outOfStock
    FROM stock_balance
    GROUP BY warehouse
    HAVING name IS NOT NULL
  `);

  // 6. Top Low Stock Items
  const [lowStockItems] = await pool.query(`
    SELECT 
      item_code as itemCode,
      material_name as itemName,
      current_balance as currentStock,
      10 as minRequired,
      unit as uom
    FROM stock_balance
    WHERE current_balance > 0 AND current_balance < 10
    ORDER BY current_balance ASC
    LIMIT 5
  `);

  // 7. Recent Movements
  const [recentMovements] = await pool.query(`
    SELECT 
      transaction_date as time,
      item_code as itemCode,
      material_name as itemName,
      transaction_type as type,
      reference_doc_number as reference,
      quantity,
      balance_after as balance,
      warehouse,
      unit as uom
    FROM stock_ledger
    ORDER BY transaction_date DESC
    LIMIT 10
  `);

  return {
    kpis: {
      totalItems: itemCount.total || 0,
      totalValue: valueStats.totalValue || 0,
      lowStockCount: valueStats.lowStockCount || 0,
      outOfStockCount: valueStats.outOfStockCount || 0,
      activeWarehouses: warehouseCount.total || 0
    },
    categoryDistribution,
    statusSummary,
    stockTrend,
    warehouseStock,
    lowStockItems,
    recentMovements
  };
};

const getAccountsReportStats = async () => {
  // 1. KPI Stats
  // Receivables from Sales Orders (not fully paid)
  const [[receivableStats]] = await pool.query(`
    SELECT 
      COALESCE(SUM(net_total), 0) as totalReceivables,
      COUNT(DISTINCT company_id) as receivableCustomers
    FROM sales_orders 
    WHERE status NOT IN ('DRAFT', 'CANCELLED', 'CLOSED')
  `);

  // Payables from Purchase Orders (not fully paid)
  const [[payableStats]] = await pool.query(`
    SELECT 
      COALESCE(SUM(total_amount), 0) as totalPayables,
      COUNT(DISTINCT vendor_id) as payableVendors
    FROM purchase_orders 
    WHERE status NOT IN ('DRAFT', 'CANCELLED', 'PAID')
  `);

  // Cash Received this month
  const [[cashReceivedStats]] = await pool.query(`
    SELECT COALESCE(SUM(payment_amount), 0) as cashReceived
    FROM customer_payments
    WHERE status = 'CONFIRMED' AND payment_date >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
  `);

  // Invoices Sent (Sales Orders converted from DRAFT)
  const [[invoiceSentStats]] = await pool.query(`
    SELECT COUNT(*) as invoicesSent
    FROM sales_orders
    WHERE status != 'DRAFT' AND created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
  `);

  // Overdue Amount (Sales orders past due date)
  // Assuming delivery_date or similar as due date for now, or just dummy overdue for UI
  const [[overdueStats]] = await pool.query(`
    SELECT 
      COALESCE(SUM(net_total), 0) as overdueAmount,
      COUNT(*) as overdueInvoices
    FROM sales_orders
    WHERE status NOT IN ('DRAFT', 'CANCELLED', 'CLOSED') AND created_at < DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
  `);

  // 2. Receivables vs Payables (Comparison)
  const totalReceivables = parseFloat(receivableStats.totalReceivables) || 0;
  const totalPayables = parseFloat(payableStats.totalPayables) || 0;
  const grandTotal = (totalReceivables + totalPayables) || 1;

  const receivablesPayables = [
    { name: 'Receivables', value: totalReceivables, percent: Math.round((totalReceivables / grandTotal) * 100) },
    { name: 'Payables', value: totalPayables, percent: Math.round((totalPayables / grandTotal) * 100) }
  ];

  // 3. Cash Flow Trend (Last 7 Days)
  const [cashFlowTrend] = await pool.query(`
    SELECT 
      DATE_FORMAT(date_list.date, '%d %b') as name,
      COALESCE((SELECT SUM(payment_amount) FROM customer_payments cp WHERE DATE(cp.payment_date) = date_list.date AND status = 'CONFIRMED'), 0) as inflow,
      COALESCE((SELECT SUM(payment_amount) FROM payments p WHERE DATE(p.payment_date) = date_list.date AND status = 'CONFIRMED'), 0) as outflow
    FROM (
      SELECT CURRENT_DATE - INTERVAL 6 DAY as date UNION ALL
      SELECT CURRENT_DATE - INTERVAL 5 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 4 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 3 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 2 DAY UNION ALL
      SELECT CURRENT_DATE - INTERVAL 1 DAY UNION ALL
      SELECT CURRENT_DATE
    ) date_list
    GROUP BY date_list.date
    ORDER BY date_list.date ASC
  `);

  // 4. Aging Summary
  const agingSummary = [
    { range: '0 - 30 Days', amount: totalReceivables * 0.7, invoiceCount: Math.ceil(receivableStats.receivableCustomers * 0.8) },
    { range: '31 - 60 Days', amount: totalReceivables * 0.2, invoiceCount: Math.ceil(receivableStats.receivableCustomers * 0.15) },
    { range: '61 - 90 Days', amount: totalReceivables * 0.08, invoiceCount: 1 },
    { range: '90+ Days', amount: totalReceivables * 0.02, invoiceCount: 0 }
  ];

  // 5. Top Customers
  const [topCustomers] = await pool.query(`
    SELECT 
      c.company_name as name,
      '' as email,
      COUNT(so.id) as totalInvoices,
      SUM(so.net_total) as outstanding,
      SUM(CASE WHEN so.created_at < DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY) THEN so.net_total ELSE 0 END) as overdue
    FROM sales_orders so
    JOIN companies c ON so.company_id = c.id
    WHERE so.status NOT IN ('DRAFT', 'CANCELLED', 'CLOSED')
    GROUP BY c.id
    ORDER BY outstanding DESC
    LIMIT 3
  `);

  // 6. Top Vendors
  const [topVendors] = await pool.query(`
    SELECT 
      v.vendor_name as name,
      v.email,
      COUNT(po.id) as totalInvoices,
      SUM(po.total_amount) as outstanding,
      SUM(CASE WHEN po.created_at < DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY) THEN po.total_amount ELSE 0 END) as overdue
    FROM purchase_orders po
    JOIN vendors v ON po.vendor_id = v.id
    WHERE po.status NOT IN ('DRAFT', 'CANCELLED', 'PAID')
    GROUP BY v.id
    ORDER BY outstanding DESC
    LIMIT 3
  `);

  // 7. Recent Transactions
  const [recentTransactions] = await pool.query(`
    (SELECT 
      'Payment Received' as type,
      payment_receipt_no as reference,
      (SELECT company_name FROM companies WHERE id = customer_id) as party,
      payment_date as date,
      NULL as dueDate,
      payment_amount as amount,
      status
    FROM customer_payments
    ORDER BY payment_date DESC LIMIT 3)
    UNION ALL
    (SELECT 
      'Vendor Payment' as type,
      payment_voucher_no as reference,
      (SELECT vendor_name FROM vendors WHERE id = vendor_id) as party,
      payment_date as date,
      NULL as dueDate,
      payment_amount as amount,
      status
    FROM payments
    ORDER BY payment_date DESC LIMIT 3)
    UNION ALL
    (SELECT 
      'Vendor Invoice' as type,
      po_number as reference,
      (SELECT vendor_name FROM vendors WHERE id = vendor_id) as party,
      created_at as date,
      expected_delivery_date as dueDate,
      total_amount as amount,
      status
    FROM purchase_orders
    ORDER BY created_at DESC LIMIT 3)
    ORDER BY date DESC
    LIMIT 10
  `);

  return {
    kpis: {
      totalReceivables: totalReceivables.toFixed(2),
      receivableCustomers: receivableStats.receivableCustomers || 0,
      totalPayables: totalPayables.toFixed(2),
      payableVendors: payableStats.payableVendors || 0,
      cashReceived: parseFloat(cashReceivedStats.cashReceived).toFixed(2),
      invoicesSent: invoiceSentStats.invoicesSent || 0,
      overdueAmount: parseFloat(overdueStats.overdueAmount).toFixed(2),
      overdueInvoices: overdueStats.overdueInvoices || 0
    },
    receivablesPayables,
    cashFlowTrend,
    agingSummary,
    topCustomers,
    topVendors,
    recentTransactions
  };
};

module.exports = { 
  getDashboardStats, 
  getAccountsDashboardStats,
  getProcurementDashboardStats,
  getProductionDashboardStats,
  getDesignDashboardStats,
  getSalesDashboardStats,
  getShipmentDashboardStats,
  getProcurementReportStats,
  getProductionReportStats,
  getInventoryReportStats,
  getAccountsReportStats
};
