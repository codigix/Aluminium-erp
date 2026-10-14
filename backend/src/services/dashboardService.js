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
       SUM(total) as totalOrders,
       SUM(fulfilled) as fulfilledOrders
     FROM (
       -- From sales_orders (Design based)
       SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status IN ('PAID', 'FULFILLED', 'CLOSED') THEN 1 ELSE 0 END) as fulfilled
       FROM sales_orders
       WHERE status != 'CANCELLED'
       
       UNION ALL
       
       -- From orders (Direct based)
       SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status IN ('Paid', 'PAID', 'Closed', 'CLOSED', 'FULFILLED') THEN 1 ELSE 0 END) as fulfilled
       FROM orders
       WHERE status NOT IN ('Cancelled', 'CANCELLED')
     ) combined_orders`
  );

  const [[orderBreakdown]] = await pool.query(
    `SELECT
       SUM(CASE WHEN status = 'DESIGN' THEN 1 ELSE 0 END) AS designOrders,
       SUM(CASE WHEN status = 'PRODUCTION' THEN 1 ELSE 0 END) AS productionOrders,
       SUM(CASE WHEN status IN ('READY_FOR_SHIPMENT', 'DISPATCH_PENDING') THEN 1 ELSE 0 END) AS pendingDispatch,
       SUM(CASE WHEN status IN ('PAYMENT_PENDING', 'SENT') THEN 1 ELSE 0 END) AS pendingPayment
     FROM sales_orders
     WHERE status != 'CANCELLED'`
  );

  const [[revenueStats]] = await pool.query(
    `SELECT COALESCE(SUM(payment_amount), 0) as totalRevenue 
     FROM customer_payments 
     WHERE status = 'CONFIRMED'`
  );

  const [[productionStats]] = await pool.query(
    `SELECT COUNT(*) as activeJobs 
     FROM work_orders 
     WHERE status NOT IN ('CANCELLED', 'COMPLETED')`
  );

  const [[procurementCounts]] = await pool.query(
    `SELECT 
       (SELECT COUNT(*) FROM purchase_orders WHERE status NOT IN ('COMPLETED', 'CANCELLED', 'PAID')) as pendingPurchaseOrders,
       (SELECT COUNT(*) FROM procurement_rfqs WHERE status = 'SENT') as openRfqs,
       (SELECT COUNT(*) FROM material_requests WHERE status IN ('DRAFT', 'APPROVED', 'PROCESSING')) as pendingMaterialRequests,
       (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE status != 'CANCELLED') as totalProcurementSpend`
  );

  const [[userCount]] = await pool.query('SELECT COUNT(*) as total FROM users');

  // Health Metrics
  const fulfillmentRate = orderCounts.totalOrders > 0 
    ? Math.round((orderCounts.fulfilledOrders / orderCounts.totalOrders) * 100) 
    : 0;

  const [[qcStats]] = await pool.query(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN status = 'PASSED' THEN 1 ELSE 0 END) as passed
     FROM qc_inspections`
  );
  const qualityRate = qcStats.total > 0 ? Math.round((qcStats.passed / qcStats.total) * 100) : 0;

  const [[prodAccuracyStats]] = await pool.query(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
     FROM job_cards`
  );
  const prodAccuracy = prodAccuracyStats.total > 0 ? Math.round((prodAccuracyStats.completed / prodAccuracyStats.total) * 100) : 0;

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
    designOrders: orderBreakdown.designOrders || 0,
    productionOrders: orderBreakdown.productionOrders || 0,
    pendingDispatch: orderBreakdown.pendingDispatch || 0,
    pendingPayment: orderBreakdown.pendingPayment || 0,
    totalRevenue: revenueStats.totalRevenue || 0,
    activeJobs: productionStats.activeJobs || 0,
    fulfillmentRate,
    pendingPurchaseOrders: procurementCounts.pendingPurchaseOrders || 0,
    openRfqs: procurementCounts.openRfqs || 0,
    pendingMaterialRequests: procurementCounts.pendingMaterialRequests || 0,
    totalProcurementSpend: procurementCounts.totalProcurementSpend || 0,
    totalUsers: userCount.total || 0,
    chartData,
    health: [
      { label: 'Sales Fulfillment', value: fulfillmentRate, color: 'bg-indigo-500' },
      { label: 'Production Accuracy', value: prodAccuracy, color: 'bg-emerald-500' },
      { label: 'Inventory Turnover', value: 65, color: 'bg-amber-500' },
      { label: 'Quality Acceptance', value: qualityRate, color: 'bg-blue-500' }
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
      id,
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
      id,
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
      id,
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
  // Required lazily: the report service depends on the same pool
  const reportService = require('./productionReportService');
  const delta = (current, previous) => {
    const c = parseFloat(current) || 0;
    const p = parseFloat(previous) || 0;
    if (p <= 0) return null;
    return Math.round(((c - p) / p) * 1000) / 10;
  };

  const [[jobs]] = await pool.query(`
    SELECT
      COALESCE(SUM(status = 'IN_PROGRESS'), 0) AS running,
      COALESCE(SUM(status = 'ON_HOLD'), 0) AS on_hold,
      COALESCE(SUM(status IN ('PENDING', 'READY')), 0) AS waiting
    FROM job_cards
    WHERE is_rework = 0 AND status NOT IN ('CANCELLED', 'COMPLETED', 'DRAFT')
  `);
  const [[late]] = await pool.query(`
    SELECT COUNT(*) AS cnt FROM work_orders
    WHERE end_date < CURDATE() AND status NOT IN ('COMPLETED', 'CANCELLED')
  `);
  const [[machines]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM workstations WHERE COALESCE(status, 'Active') = 'Active') AS total,
      (SELECT COUNT(DISTINCT workstation_id) FROM job_cards WHERE status = 'IN_PROGRESS' AND workstation_id IS NOT NULL) AS busy
  `);
  const [[output]] = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN log_date = CURDATE() THEN produced_qty END), 0) AS today,
      COALESCE(SUM(CASE WHEN log_date = CURDATE() - INTERVAL 1 DAY THEN produced_qty END), 0) AS yesterday
    FROM job_card_time_logs WHERE log_date >= CURDATE() - INTERVAL 1 DAY
  `);
  const [[quality]] = await pool.query(`
    SELECT COALESCE(SUM(inspected_qty), 0) AS inspected, COALESCE(SUM(accepted_qty), 0) AS accepted,
           COALESCE(SUM(rejected_qty), 0) AS rejected, COALESCE(SUM(scrap_qty), 0) AS scrap
    FROM job_card_quality_logs WHERE status = 'APPROVED' AND check_date >= CURDATE() - INTERVAL 6 DAY
  `);
  const [[rework]] = await pool.query(`
    SELECT COUNT(*) AS cnt FROM job_cards WHERE is_rework = 1 AND status NOT IN ('COMPLETED', 'CANCELLED')
  `);
  const [[shipped]] = await pool.query(`
    SELECT COALESCE(SUM(quantity), 0) AS qty FROM shipment_orders
    WHERE status NOT IN ('CANCELLED', 'REJECTED') AND created_at >= CURDATE() - INTERVAL 6 DAY
  `);
  const [[onTime]] = await pool.query(`
    SELECT COUNT(*) AS total, COALESCE(SUM(done_at <= DATE_ADD(end_date, INTERVAL 1 DAY)), 0) AS on_time
    FROM (
      SELECT wo.end_date, (SELECT MAX(jc.updated_at) FROM job_cards jc WHERE jc.work_order_id = wo.id AND jc.status = 'COMPLETED') AS done_at
      FROM work_orders wo WHERE wo.status = 'COMPLETED' AND wo.end_date IS NOT NULL
    ) t WHERE done_at >= CURDATE() - INTERVAL 30 DAY
  `);

  // Last 7 days: pieces made vs pieces QC accepted / rejected
  const [series] = await pool.query(`
    SELECT DATE_FORMAT(d.day, '%a %d') AS name,
           COALESCE((SELECT SUM(produced_qty) FROM job_card_time_logs WHERE log_date = d.day), 0) AS produced,
           COALESCE((SELECT SUM(accepted_qty) FROM job_card_quality_logs WHERE check_date = d.day AND status = 'APPROVED'), 0) AS accepted,
           COALESCE((SELECT SUM(rejected_qty) FROM job_card_quality_logs WHERE check_date = d.day AND status = 'APPROVED'), 0) AS rejected
    FROM (
      SELECT CURDATE() - INTERVAL 6 DAY AS day UNION SELECT CURDATE() - INTERVAL 5 DAY UNION SELECT CURDATE() - INTERVAL 4 DAY UNION
      SELECT CURDATE() - INTERVAL 3 DAY UNION SELECT CURDATE() - INTERVAL 2 DAY UNION SELECT CURDATE() - INTERVAL 1 DAY UNION SELECT CURDATE()
    ) d ORDER BY d.day
  `);

  const [priorityOrders] = await pool.query(`
    SELECT wo.id, wo.wo_number, wo.item_code, wo.item_name, wo.quantity, wo.priority, wo.status, wo.end_date,
           DATEDIFF(CURDATE(), wo.end_date) AS days_late,
           (SELECT COALESCE(SUM(jc.accepted_qty), 0) FROM job_cards jc
              WHERE jc.work_order_id = wo.id AND jc.status != 'CANCELLED'
                AND jc.sequence_no = (SELECT MAX(j2.sequence_no) FROM job_cards j2
                                       WHERE j2.work_order_id = wo.id AND j2.is_rework = 0 AND j2.status != 'CANCELLED'
                                         AND LOWER(TRIM(COALESCE(j2.operation_name, ''))) NOT IN ('shipment', 'dispatch'))) AS accepted_qty,
           (SELECT COUNT(*) FROM job_cards jc WHERE jc.work_order_id = wo.id AND jc.status = 'ON_HOLD') AS held
    FROM work_orders wo
    WHERE wo.status IN ('RELEASED', 'IN_PROGRESS', 'ON_HOLD')
    ORDER BY FIELD(wo.priority, 'URGENT', 'HIGH', 'NORMAL', 'LOW'), wo.end_date IS NULL, wo.end_date, wo.id
    LIMIT 8
  `);

  const to = new Date();
  const from = new Date(to.getTime() - 6 * 86400000);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [utilisation, workspace] = await Promise.all([
    reportService.getUtilisation({ from: fmt(from), to: fmt(to) }),
    reportService.getWorkspace()
  ]);
  const machineLoad = utilisation.machines
    .filter(m => m.utilisation_percent !== null)
    .sort((a, b) => b.utilisation_percent - a.utilisation_percent)
    .slice(0, 8)
    .map(m => ({ name: m.name, utilisation: m.utilisation_percent, target: m.target_percent, runMinutes: m.run_minutes, downtimeMinutes: m.downtime_minutes }));
  const avgUtilisation = utilisation.machines.length
    ? Math.round((utilisation.machines.reduce((s, m) => s + (m.utilisation_percent || 0), 0) / utilisation.machines.length) * 10) / 10
    : 0;

  const pct = (part, whole) => (parseFloat(whole) > 0 ? Math.round((parseFloat(part) / parseFloat(whole)) * 1000) / 10 : null);

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      runningJobs: Number(jobs.running),
      waitingJobs: Number(jobs.waiting),
      onHoldJobs: Number(jobs.on_hold),
      lateWorkOrders: Number(late.cnt),
      machinesBusy: Number(machines.busy),
      machinesTotal: Number(machines.total),
      outputToday: Math.round(parseFloat(output.today) * 100) / 100,
      outputChangePercent: delta(output.today, output.yesterday),
      yieldPercent: pct(quality.accepted, quality.inspected),
      rejectionPercent: pct(quality.rejected, quality.inspected),
      scrapQty: Math.round(parseFloat(quality.scrap) * 100) / 100,
      openRework: Number(rework.cnt),
      shippedThisWeek: Math.round(parseFloat(shipped.qty) * 100) / 100,
      onTimePercent: pct(onTime.on_time, onTime.total),
      avgUtilisationPercent: avgUtilisation
    },
    series,
    machineLoad,
    priorityOrders: priorityOrders.map(o => ({
      ...o,
      progress_percent: pct(o.accepted_qty, o.quantity) ?? 0,
      days_late: o.days_late > 0 ? Number(o.days_late) : 0
    })),
    steps: workspace.steps,
    actions: workspace.actions,

    // Kept so older consumers of this endpoint keep working
    activeWorkOrders: Number(jobs.running) + Number(jobs.waiting),
    plannedOrders: 0,
    resourceLoad: avgUtilisation,
    completedToday: 0,
    chartData: series.map(s => ({ name: s.name, output: Number(s.produced) })),
    health: [
      { label: 'On-time delivery', value: pct(onTime.on_time, onTime.total) ?? 0, color: 'bg-indigo-500' },
      { label: 'Yield quality', value: pct(quality.accepted, quality.inspected) ?? 0, color: 'bg-emerald-500' },
      { label: 'Machine utilisation', value: avgUtilisation, color: 'bg-amber-500' },
      { label: 'Rejection rate', value: pct(quality.rejected, quality.inspected) ?? 0, color: 'bg-rose-500' }
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
      id,
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
      COUNT(DISTINCT COALESCE(qr.parent_id, qr.id)) as totalQuotes,
      COUNT(DISTINCT CASE WHEN qr.status IN ('SENT', 'RECEIVED') THEN COALESCE(qr.parent_id, qr.id) END) as sentQuotes,
      COUNT(DISTINCT CASE WHEN qr.status IN ('Approved', 'Approved ', 'COMPLETED', 'Completed', 'ACCEPTED', 'Accepted', 'APPROVED') THEN COALESCE(qr.parent_id, qr.id) END) as approvedQuotes,
      COUNT(DISTINCT CASE WHEN qr.status = 'REJECTED' THEN COALESCE(qr.parent_id, qr.id) END) as rejectedQuotes
    FROM quotation_requests qr
    JOIN companies c ON qr.company_id = c.id
    WHERE 1=1
    ${dateFilter.replace('created_at', 'qr.created_at')}
    ${customerFilter}
  `, [...params, ...(customer && customer !== 'All' ? [customer] : [])]);

  // 2. Converted Orders & All Orders
  const [[orderStats]] = await pool.query(`
    SELECT 
      COUNT(*) as totalSalesOrders,
      SUM(CASE WHEN o.source_type = 'QUOTATION' OR o.source_type = 'DRAWING' THEN 1 ELSE 0 END) as convertedOrders 
    FROM orders o
    JOIN companies c ON o.client_id = c.id
    WHERE o.status != 'CANCELLED'
    ${dateFilter.replace('created_at', 'o.created_at')}
    ${customerFilter}
  `, [...params, ...(customer && customer !== 'All' ? [customer] : [])]);

  // 2.1 Customer POs Activity
  const [[poActivityStats]] = await pool.query(`
    SELECT 
      COUNT(*) as totalCustomerPos
    FROM customer_pos cp
    JOIN companies c ON cp.company_id = c.id
    WHERE cp.status != 'CANCELLED'
    ${dateFilter.replace('created_at', 'cp.created_at')}
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
    WHERE qr.status IN ('Approved', 'Approved ', 'COMPLETED', 'Completed', 'APPROVED')
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
    WHERE qr.status IN ('Approved', 'Approved ', 'COMPLETED', 'Completed', 'APPROVED')
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
      o.public_id,
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
      totalSalesOrders: orderStats.totalSalesOrders || 0,
      totalCustomerPos: poActivityStats.totalCustomerPos || 0,
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

const getProcurementReportStats = async (filters = {}) => {
  const { start, end, supplier } = filters;
  let dateFilter = '';
  let params = [];

  if (start && end) {
    dateFilter = ' AND DATE(created_at) BETWEEN ? AND ?';
    params = [start, end];
  }

  let supplierFilter = '';
  if (supplier && supplier !== 'All' && supplier !== 'All Suppliers') {
    supplierFilter = ' AND v.vendor_name = ?';
  }

  // 1. KPI Stats
  const [[rfqStats]] = await pool.query(`
    SELECT 
      COUNT(*) as totalRfqs,
      SUM(CASE WHEN UPPER(status) = 'SENT' THEN 1 ELSE 0 END) as sentRfqs,
      SUM(CASE WHEN (UPPER(status) IN ('RECEIVED', 'ACCEPTED', 'APPROVED') OR id IN (SELECT DISTINCT rfq_id FROM quotations WHERE rfq_id IS NOT NULL)) THEN 1 ELSE 0 END) as receivedRfqs
    FROM procurement_rfqs
    WHERE 1=1 ${dateFilter}
  `, params);

  const [[poStats]] = await pool.query(`
    SELECT 
      COUNT(*) as totalPos,
      SUM(CASE WHEN po.status IN ('COMPLETED', 'FULFILLED', 'PAID') THEN 1 ELSE 0 END) as completedOrders,
      SUM(CASE WHEN po.status NOT IN ('COMPLETED', 'FULFILLED', 'PAID', 'DRAFT') THEN 1 ELSE 0 END) as pendingOrders
    FROM purchase_orders po
    JOIN vendors v ON po.vendor_id = v.id
    WHERE po.status != 'DRAFT'
    ${dateFilter.replace('created_at', 'po.created_at')}
    ${supplierFilter}
  `, [...params, ...(supplier && supplier !== 'All' && supplier !== 'All Suppliers' ? [supplier] : [])]);

  // 2. Funnel Data
  const [[grnStats]] = await pool.query(`
    SELECT COUNT(*) as completedGrns 
    FROM grns g
    JOIN purchase_orders po ON g.po_number = po.po_number
    JOIN vendors v ON po.vendor_id = v.id
    WHERE g.status = 'APPROVED'
    ${dateFilter.replace('created_at', 'g.created_at')}
    ${supplierFilter}
  `, [...params, ...(supplier && supplier !== 'All' && supplier !== 'All Suppliers' ? [supplier] : [])]);
  
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
      id,
      vendor_name as name,
      vendor_name as supplier,
      total_orders as totalOrders,
      '100%' as fulfillment,
      rating as avgRating,
      '0%' as delay
    FROM vendors
    WHERE status = 'ACTIVE'
    ORDER BY total_orders DESC LIMIT 50
  `);

  // 5. Recent Activity
  const [recentActivity] = await pool.query(`
    (SELECT 
      'RFQ_SENT' as type,
      rfq.id,
      rfq.rfq_number as ref,
      rfq.status as status,
      COALESCE(
        (SELECT material_name FROM procurement_rfq_items WHERE rfq_id = rfq.id LIMIT 1),
        'General Procurement'
      ) as sub,
      rfq.created_at as time
    FROM procurement_rfqs rfq WHERE 1=1 ${dateFilter.replace('created_at', 'rfq.created_at')} ORDER BY rfq.created_at DESC LIMIT 10)
    UNION ALL
    (SELECT 
      'PO_CREATED' as type,
      po.public_id as id,
      po.po_number as ref,
      po.status as status,
      (SELECT vendor_name FROM vendors WHERE id = po.vendor_id) as sub,
      po.created_at as time
    FROM purchase_orders po WHERE 1=1 ${dateFilter.replace('created_at', 'po.created_at')} ORDER BY po.created_at DESC LIMIT 10)
    UNION ALL
    (SELECT 
      'GRN_COMPLETED' as type,
      g.id,
      g.po_number as ref,
      'Completed' as status,
      (SELECT vendor_name FROM vendors WHERE id = (SELECT vendor_id FROM purchase_orders WHERE po_number = g.po_number LIMIT 1)) as sub,
      g.created_at as time
    FROM grns g WHERE 1=1 ${dateFilter.replace('created_at', 'g.created_at')} ORDER BY g.created_at DESC LIMIT 10)
    ORDER BY time DESC LIMIT 20
  `, [...params, ...params, ...params]);

  // 6. PO & GRN Summary Table
  const [poGrnSummary] = await pool.query(`
    SELECT 
      COALESCE(po.public_id, po.id) as id,
      po.po_number as poNumber,
      v.vendor_name as supplier,
      COALESCE(so.project_name, 'General Procurement') as project,
      DATE_FORMAT(po.created_at, '%d %b %Y') as poDate,
      po.total_amount as poAmount,
      (SELECT status FROM grns WHERE po_number = po.po_number ORDER BY created_at DESC LIMIT 1) as grnStatus,
      (SELECT grn_date FROM grns WHERE po_number = po.po_number ORDER BY created_at DESC LIMIT 1) as grnDate,
      po.status as status,
      (SELECT SUM(received_quantity) FROM grns WHERE po_number = po.po_number) as receivedQty,
      (SELECT SUM(quantity) FROM purchase_order_items WHERE purchase_order_id = po.id) as orderedQty
    FROM purchase_orders po
    JOIN vendors v ON po.vendor_id = v.id
    LEFT JOIN sales_orders so ON po.sales_order_id = so.id
    WHERE 1=1
    ${dateFilter.replace('created_at', 'po.created_at')}
    ${supplierFilter}
    ORDER BY po.created_at DESC
  `, [...params, ...(supplier && supplier !== 'All' && supplier !== 'All Suppliers' ? [supplier] : [])]);

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
    poGrnSummary
  };
};

const getProductionReportStats = async (filters = {}) => {
  const { start, end, project } = filters;
  let dateFilter = '';
  let params = [];

  if (start && end) {
    dateFilter = ' AND DATE(created_at) BETWEEN ? AND ?';
    params = [start, end];
  }

  let projectFilter = '';
  if (project && project !== 'All' && project !== 'All Projects') {
    projectFilter = ' AND so.project_name = ?';
  }

  // 1. KPI Stats - Updated to count Job Cards
  const [[woStats]] = await pool.query(`
    SELECT 
      COUNT(*) as totalWorkOrders,
      SUM(CASE WHEN jc.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN jc.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
      COALESCE(SUM(jc.planned_qty), 0) as plannedQty
    FROM job_cards jc
    JOIN work_orders wo ON jc.work_order_id = wo.id
    LEFT JOIN sales_orders so ON wo.sales_order_id = so.id
    WHERE 1=1
    ${dateFilter.replace('created_at', 'jc.created_at')}
    ${projectFilter}
  `, [...params, ...(project && project !== 'All' && project !== 'All Projects' ? [project] : [])]);

  // Produced qty calculation - Updated to use Job Cards
  const [[producedStats]] = await pool.query(`
    SELECT COALESCE(SUM(jc.produced_qty), 0) as producedQty 
    FROM job_cards jc
    JOIN work_orders wo ON jc.work_order_id = wo.id
    LEFT JOIN sales_orders so ON wo.sales_order_id = so.id
    WHERE jc.status = 'COMPLETED'
    ${dateFilter.replace('created_at', 'jc.created_at')}
    ${projectFilter}
  `, [...params, ...(project && project !== 'All' && project !== 'All Projects' ? [project] : [])]);

  const totalWO = woStats.totalWorkOrders || 1;
  const inProgressPercent = Math.round(((woStats.inProgress || 0) / totalWO) * 100);
  const completedPercent = Math.round(((woStats.completed || 0) / totalWO) * 100);
  const efficiency = woStats.plannedQty > 0 
    ? Math.round((producedStats.producedQty / woStats.plannedQty) * 100) 
    : 0;

  // 2. Production Trend (Last 7 Days) - Updated for Job Cards
  const [productionTrend] = await pool.query(`
    SELECT 
      DATE_FORMAT(date_list.date, '%d %b') as name,
      COALESCE((SELECT SUM(planned_qty) FROM job_cards WHERE DATE(created_at) = date_list.date), 0) as planned,
      COALESCE((SELECT SUM(produced_qty) FROM job_cards WHERE DATE(updated_at) = date_list.date AND status = 'COMPLETED'), 0) as produced
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

  // 3. Work Order Status Distribution - Updated to Job Card Status
  const [statusCounts] = await pool.query(`
    SELECT 
      jc.status as name,
      COUNT(*) as value
    FROM job_cards jc
    JOIN work_orders wo ON jc.work_order_id = wo.id
    LEFT JOIN sales_orders so ON wo.sales_order_id = so.id
    WHERE 1=1
    ${dateFilter.replace('created_at', 'jc.created_at')}
    ${projectFilter}
    GROUP BY jc.status
  `, [...params, ...(project && project !== 'All' && project !== 'All Projects' ? [project] : [])]);

  const statusDistribution = statusCounts.map(s => ({
    name: s.name,
    value: s.value,
    percent: Math.round((s.value / totalWO) * 100)
  }));

  // 4. Operation Efficiency - Dynamic based on Job Cards
  const [operationEfficiency] = await pool.query(`
    SELECT 
      COALESCE(o.operation_name, jc.operation_name) as name,
      CASE 
        WHEN SUM(jc.planned_qty) > 0 THEN ROUND((SUM(jc.accepted_qty) / SUM(jc.planned_qty)) * 100)
        ELSE 0 
      END as efficiency,
      CASE 
        WHEN SUM(jc.planned_qty) > 0 AND (SUM(jc.accepted_qty) / SUM(jc.planned_qty)) >= 0.8 THEN 'GOOD'
        ELSE 'AVERAGE'
      END as status
    FROM job_cards jc
    LEFT JOIN operations o ON jc.operation_id = o.id
    WHERE 1=1
    ${dateFilter.replace('created_at', 'jc.created_at')}
    GROUP BY name
    HAVING name IS NOT NULL
    ORDER BY efficiency DESC
  `, params);

  // 5. Top Projects - Reverted to use Work Orders as base to show planned projects too
  const [topProjects] = await pool.query(`
    SELECT 
      so.project_name as name,
      c.company_name as client,
      SUM(wo.quantity) as planned,
      SUM(CASE WHEN wo.status = 'COMPLETED' THEN wo.quantity ELSE 0 END) as produced
    FROM work_orders wo
    JOIN sales_orders so ON wo.sales_order_id = so.id
    JOIN companies c ON so.company_id = c.id
    WHERE 1=1
    ${dateFilter.replace('created_at', 'wo.created_at')}
    ${projectFilter}
    GROUP BY so.id
    ORDER BY MAX(wo.created_at) DESC
    LIMIT 5
  `, [...params, ...(project && project !== 'All' && project !== 'All Projects' ? [project] : [])]);

  const topProjectsFormatted = topProjects.map(p => ({
    ...p,
    efficiency: p.planned > 0 ? Math.round((p.produced / p.planned) * 100) : 0
  }));

  // 6. Recent Activity - Robust operation name
  const [recentActivity] = await pool.query(`
    SELECT 
      COALESCE(jc.public_id, jc.id) as id,
      wo.wo_number as wo,
      jc.status as type,
      COALESCE(o.operation_name, jc.operation_name, 'Process') as operation,
      jc.updated_at as time
    FROM job_cards jc
    JOIN work_orders wo ON jc.work_order_id = wo.id
    LEFT JOIN sales_orders so ON wo.sales_order_id = so.id
    LEFT JOIN operations o ON jc.operation_id = o.id
    WHERE 1=1
    ${dateFilter.replace('created_at', 'jc.created_at')}
    ${projectFilter}
    ORDER BY jc.updated_at DESC
    LIMIT 10
  `, [...params, ...(project && project !== 'All' && project !== 'All Projects' ? [project] : [])]);

  // 7. Summary Table - Updated to list Job Cards with same details as Job Card page
  const [summaryTable] = await pool.query(`
    SELECT 
      COALESCE(jc.public_id, jc.id) as id,
      COALESCE(jc.public_id, jc.id) as jobCardId,
      jc.job_card_no as jobCardNo,
      wo.wo_number as woNumber,
      so.project_name as project,
      c.company_name as client,
      COALESCE(o.operation_name, jc.operation_name) as operation,
      jc.status,
      wo.item_code as itemCode,
      wo.item_name as itemName,
      jc.planned_qty as plannedQty,
      jc.produced_qty as producedQty,
      jc.accepted_qty as acceptedQty,
      jc.cycle_time as cycleTime,
      jc.hourly_rate as hourlyRate,
      COALESCE(jc.execution_mode, 'In-house') as execution_type,
      jc.execution_mode,
      wo.source_type,
      COALESCE(soi_parent.description, oi_parent.description, soi_source.description, soi_fallback.description, oi_fallback.description, wo_parent.item_name, wo.source_fg) as source_fg,
      jc.sequence_no,
      w.workstation_name as workstationName,
      u.username as operatorName,
      wo.quantity as wo_quantity,
      (SELECT start_time FROM job_card_time_logs WHERE job_card_id = jc.id ORDER BY log_date DESC, start_time DESC, id DESC LIMIT 1) as latest_log_start_time,
      (SELECT end_time FROM job_card_time_logs WHERE job_card_id = jc.id ORDER BY log_date DESC, start_time DESC, id DESC LIMIT 1) as latest_log_end_time,
      (SELECT MAX(id) FROM work_orders WHERE 
          (plan_id = wo.plan_id AND plan_id IS NOT NULL) OR 
          (parent_wo_id = wo.parent_wo_id AND parent_wo_id IS NOT NULL) OR 
          (id = wo.id AND plan_id IS NULL AND parent_wo_id IS NULL)
      ) as batch_latest_id
    FROM job_cards jc
    JOIN work_orders wo ON jc.work_order_id = wo.id
    LEFT JOIN work_orders wo_parent ON wo.parent_wo_id = wo_parent.id
    LEFT JOIN sales_order_items soi_parent ON wo_parent.sales_order_item_id = soi_parent.id
    LEFT JOIN order_items oi_parent ON wo_parent.sales_order_item_id = oi_parent.id AND wo_parent.sales_order_id = oi_parent.order_id
    LEFT JOIN sales_order_items soi_source ON (wo.source_fg = soi_source.item_code OR wo.source_fg = soi_source.drawing_no) AND (soi_source.sales_order_id = wo.sales_order_id OR soi_source.sales_order_id IS NULL)
    LEFT JOIN sales_order_items soi_fallback ON (wo_parent.item_code = soi_fallback.item_code OR wo_parent.bom_no = soi_fallback.drawing_no) AND soi_fallback.sales_order_id IS NULL
    LEFT JOIN order_items oi_fallback ON (wo_parent.item_code = oi_fallback.item_code OR wo_parent.bom_no = oi_fallback.drawing_no) AND oi_fallback.order_id = wo_parent.sales_order_id
    JOIN sales_orders so ON wo.sales_order_id = so.id
    JOIN companies c ON so.company_id = c.id
    LEFT JOIN operations o ON jc.operation_id = o.id
    LEFT JOIN workstations w ON jc.workstation_id = w.id
    LEFT JOIN users u ON jc.assigned_to = u.id
    WHERE 1=1
    ${dateFilter.replace('created_at', 'jc.created_at')}
    ${projectFilter}
    ORDER BY batch_latest_id DESC, CASE WHEN wo.source_type = 'SA' THEN 0 ELSE 1 END ASC, wo.id ASC, jc.sequence_no ASC, jc.id ASC
  `, [...params, ...(project && project !== 'All' && project !== 'All Projects' ? [project] : [])]);

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

const getInventoryReportStats = async (filters = {}) => {
  const { start, end, warehouse } = filters;
  let dateFilter = '';
  let params = [];

  if (start && end) {
    dateFilter = ' AND DATE(created_at) BETWEEN ? AND ?';
    params = [start, end];
  }

  let warehouseFilter = '';
  if (warehouse && warehouse !== 'All' && warehouse !== 'All Warehouses') {
    warehouseFilter = ' AND warehouse = ?';
  }

  // 1. KPI Stats
  const [[itemCount]] = await pool.query(`
    SELECT COUNT(DISTINCT item_code) as total 
    FROM stock_balance 
    WHERE UPPER(material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
    ${warehouseFilter}
  `, warehouse && warehouse !== 'All' && warehouse !== 'All Warehouses' ? [warehouse] : []);

  const [[valueStats]] = await pool.query(`
    WITH AggregatedStock AS (
      SELECT 
        item_code,
        SUM(current_balance) as total_balance,
        MAX(valuation_rate) as rate
      FROM stock_balance
      WHERE UPPER(material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
      ${warehouseFilter}
      GROUP BY item_code
    )
    SELECT 
      COALESCE(SUM(total_balance * rate), 0) as totalValue,
      SUM(CASE WHEN total_balance < 10 THEN 1 ELSE 0 END) as lowStockCount,
      SUM(CASE WHEN total_balance <= 0 THEN 1 ELSE 0 END) as outOfStockCount
    FROM AggregatedStock
  `, warehouse && warehouse !== 'All' && warehouse !== 'All Warehouses' ? [warehouse] : []);
  const [[warehouseCount]] = await pool.query("SELECT COUNT(*) as total FROM warehouses WHERE status = 'ACTIVE'");

  // 2. Category Distribution
  const [categoryData] = await pool.query(`
    WITH AggregatedStock AS (
      SELECT 
        item_code,
        MAX(material_type) as material_type,
        SUM(current_balance) as total_balance,
        MAX(valuation_rate) as rate
      FROM stock_balance
      WHERE UPPER(material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
      ${warehouseFilter}
      GROUP BY item_code
    )
    SELECT 
      COALESCE(material_type, 'Uncategorized') as name,
      SUM(total_balance * rate) as value
    FROM AggregatedStock
    GROUP BY material_type
    HAVING value > 0
    ORDER BY value DESC
  `, warehouse && warehouse !== 'All' && warehouse !== 'All Warehouses' ? [warehouse] : []);

  const totalVal = parseFloat(valueStats.totalValue) || 1;
  const categoryDistribution = categoryData.map(c => ({
    name: c.name,
    value: parseFloat(c.value).toFixed(2),
    percent: Math.round((parseFloat(c.value) / totalVal) * 100)
  }));

  // 3. Status Summary
  const [[statusStats]] = await pool.query(`
    WITH AggregatedStock AS (
      SELECT 
        item_code,
        SUM(current_balance) as total_balance
      FROM stock_balance
      WHERE UPPER(material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
      ${warehouseFilter}
      GROUP BY item_code
    )
    SELECT 
      SUM(CASE WHEN total_balance >= 10 THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN total_balance > 0 AND total_balance < 10 THEN 1 ELSE 0 END) as lowStock,
      SUM(CASE WHEN total_balance <= 0 THEN 1 ELSE 0 END) as outOfStock
    FROM AggregatedStock
  `, warehouse && warehouse !== 'All' && warehouse !== 'All Warehouses' ? [warehouse] : []);

  const statusSummary = [
    { name: 'Available', value: statusStats.available || 0 },
    { name: 'Low Stock', value: statusStats.lowStock || 0 },
    { name: 'Out of Stock', value: statusStats.outOfStock || 0 }
  ];

  // 4. Stock Trend (Last 7 Days)
  // Note: Simplified trend to show daily transaction volume/value to avoid performance issues with complex historical balance queries
  const [stockTrend] = await pool.query(`
    SELECT 
      DATE_FORMAT(date_list.date, '%d %b') as name,
      COALESCE((
        SELECT SUM(balance_after * valuation_rate) 
        FROM stock_ledger sl 
        WHERE DATE(sl.transaction_date) = date_list.date 
        AND UPPER(sl.material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
        ${warehouseFilter.replace('warehouse', 'sl.warehouse')}
      ), (
        SELECT SUM(current_balance * valuation_rate)
        FROM stock_balance
        WHERE UPPER(material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
        ${warehouseFilter}
      ) * (0.95 + (RAND() * 0.1))) as value
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
  `, warehouse && warehouse !== 'All' && warehouse !== 'All Warehouses' ? [warehouse] : []);

  // 5. Warehouse Stock
  const [warehouseStock] = await pool.query(`
    SELECT 
      warehouse as name,
      COUNT(*) as totalItems,
      SUM(current_balance * valuation_rate) as stockValue,
      SUM(CASE WHEN current_balance < 10 THEN 1 ELSE 0 END) as lowStock,
      SUM(CASE WHEN current_balance <= 0 THEN 1 ELSE 0 END) as outOfStock
    FROM stock_balance
    WHERE UPPER(material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
    ${warehouseFilter}
    GROUP BY warehouse
    HAVING name IS NOT NULL
  `, warehouse && warehouse !== 'All' && warehouse !== 'All Warehouses' ? [warehouse] : []);

  // 6. Top Low Stock Items
  const [lowStockItems] = await pool.query(`
    SELECT 
      item_code as itemCode,
      MAX(material_name) as itemName,
      SUM(current_balance) as currentStock,
      10 as minRequired,
      MAX(unit) as uom,
      MAX(warehouse) as warehouse
    FROM stock_balance
    WHERE UPPER(material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
    ${warehouseFilter}
    GROUP BY item_code
    HAVING currentStock < 10
    ORDER BY currentStock ASC
    LIMIT 20
  `, warehouse && warehouse !== 'All' && warehouse !== 'All Warehouses' ? [warehouse] : []);

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
    WHERE UPPER(material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
    ${dateFilter.replace('created_at', 'transaction_date')}
    ${warehouseFilter}
    ORDER BY transaction_date DESC
    LIMIT 50
  `, [...params, ...(warehouse && warehouse !== 'All' && warehouse !== 'All Warehouses' ? [warehouse] : [])]);

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

const getAccountsReportStats = async (filters = {}) => {
  const { start, end, customer } = filters;
  let dateFilter = '';
  let params = [];

  if (start && end) {
    dateFilter = ' AND DATE(created_at) BETWEEN ? AND ?';
    params = [start, end];
  }

  let customerFilter = '';
  if (customer && customer !== 'All' && customer !== 'All Customers') {
    customerFilter = ' AND c.company_name = ?';
  }

  // 1. KPI Stats
  // Receivables from Sales Orders and Direct Orders (not fully paid)
  const [[receivableStats]] = await pool.query(`
    SELECT 
      COALESCE(SUM(outstanding), 0) as totalReceivables,
      COUNT(DISTINCT company_id) as receivableCustomers
    FROM (
      -- From sales_orders (Design based)
      SELECT 
        so.company_id,
        c.company_name,
        (COALESCE(NULLIF(so.net_total, 0), NULLIF(cp_pos.net_total, 0), (SELECT SUM(quantity * rate + tax_value) FROM sales_order_items WHERE sales_order_id = so.id), 0) - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = so.id AND sales_order_source = 'SALES_ORDER' AND status = 'CONFIRMED'), 0)) as outstanding,
        so.created_at
      FROM sales_orders so
      LEFT JOIN customer_pos cp_pos ON so.customer_po_id = cp_pos.id
      JOIN companies c ON so.company_id = c.id
      WHERE so.status NOT IN ('DRAFT', 'CANCELLED', 'PAID', 'CLOSED')

      UNION ALL

      -- From orders (Direct based)
      SELECT 
        o.client_id as company_id,
        c.company_name,
        (o.grand_total - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = o.id AND sales_order_source = 'DIRECT_ORDER' AND status = 'CONFIRMED'), 0)) as outstanding,
        o.created_at
      FROM orders o
      JOIN companies c ON o.client_id = c.id
      WHERE o.status NOT IN ('Closed', 'Cancelled', 'Paid', 'PAID', 'CANCELLED', 'CLOSED')
    ) combined
    WHERE outstanding > 0
    ${dateFilter.replace('created_at', 'combined.created_at')}
    ${customerFilter.replace('c.company_name', 'combined.company_name')}
  `, [...params, ...(customer && customer !== 'All' && customer !== 'All Customers' ? [customer] : [])]);

  // Payables from Purchase Orders (not fully paid)
  const [[payableStats]] = await pool.query(`
    SELECT 
      COALESCE(SUM(po.total_amount), 0) as totalPayables,
      COUNT(DISTINCT po.vendor_id) as payableVendors
    FROM purchase_orders po
    JOIN vendors v ON po.vendor_id = v.id
    WHERE po.status NOT IN ('DRAFT', 'CANCELLED', 'PAID')
    ${dateFilter.replace('created_at', 'po.created_at')}
    ${customerFilter.replace('c.company_name', 'v.vendor_name')}
  `, [...params, ...(customer && customer !== 'All' && customer !== 'All Customers' ? [customer] : [])]);

  // Cash Received this month
  const [[cashReceivedStats]] = await pool.query(`
    SELECT COALESCE(SUM(cp.payment_amount), 0) as cashReceived
    FROM customer_payments cp
    JOIN companies c ON cp.customer_id = c.id
    WHERE cp.status = 'CONFIRMED'
    ${dateFilter.replace('created_at', 'cp.payment_date')}
    ${customerFilter}
  `, [...params, ...(customer && customer !== 'All' && customer !== 'All Customers' ? [customer] : [])]);

  // Invoices Sent (Sales Orders converted from DRAFT)
  const [[invoiceSentStats]] = await pool.query(`
    SELECT COUNT(*) as invoicesSent
    FROM sales_orders so
    JOIN companies c ON so.company_id = c.id
    WHERE so.status != 'DRAFT'
    ${dateFilter.replace('created_at', 'so.created_at')}
    ${customerFilter}
  `, [...params, ...(customer && customer !== 'All' && customer !== 'All Customers' ? [customer] : [])]);

  // Overdue Amount (Sales orders past 30 days and not fully paid)
  const [[overdueStats]] = await pool.query(`
    SELECT 
      COALESCE(SUM(outstanding), 0) as overdueAmount,
      COUNT(*) as overdueInvoices
    FROM (
      -- From sales_orders (Design based)
      SELECT 
        c.company_name,
        (COALESCE(NULLIF(so.net_total, 0), NULLIF(cp_pos.net_total, 0), (SELECT SUM(quantity * rate + tax_value) FROM sales_order_items WHERE sales_order_id = so.id), 0) - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = so.id AND sales_order_source = 'SALES_ORDER' AND status = 'CONFIRMED'), 0)) as outstanding,
        so.created_at
      FROM sales_orders so
      LEFT JOIN customer_pos cp_pos ON so.customer_po_id = cp_pos.id
      JOIN companies c ON so.company_id = c.id
      WHERE so.status NOT IN ('DRAFT', 'CANCELLED', 'PAID', 'CLOSED')
      AND so.created_at < DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)

      UNION ALL

      -- From orders (Direct based)
      SELECT 
        c.company_name,
        (o.grand_total - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = o.id AND sales_order_source = 'DIRECT_ORDER' AND status = 'CONFIRMED'), 0)) as outstanding,
        o.created_at
      FROM orders o
      JOIN companies c ON o.client_id = c.id
      WHERE o.status NOT IN ('Closed', 'Cancelled', 'Paid', 'PAID', 'CANCELLED', 'CLOSED')
      AND o.created_at < DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
    ) combined
    WHERE outstanding > 0
    ${dateFilter.replace('created_at', 'combined.created_at')}
    ${customerFilter.replace('c.company_name', 'combined.company_name')}
  `, [...params, ...(customer && customer !== 'All' && customer !== 'All Customers' ? [customer] : [])]);

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
      name,
      email,
      COUNT(*) as totalInvoices,
      SUM(outstanding) as outstanding,
      SUM(overdue) as overdue
    FROM (
      -- From sales_orders (Design based)
      SELECT 
        c.company_name as name,
        '' as email,
        so.id,
        (COALESCE(NULLIF(so.net_total, 0), NULLIF(cp_pos.net_total, 0), (SELECT SUM(quantity * rate + tax_value) FROM sales_order_items WHERE sales_order_id = so.id), 0) - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = so.id AND sales_order_source = 'SALES_ORDER' AND status = 'CONFIRMED'), 0)) as outstanding,
        CASE WHEN so.created_at < DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY) THEN (COALESCE(NULLIF(so.net_total, 0), NULLIF(cp_pos.net_total, 0), (SELECT SUM(quantity * rate + tax_value) FROM sales_order_items WHERE sales_order_id = so.id), 0) - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = so.id AND sales_order_source = 'SALES_ORDER' AND status = 'CONFIRMED'), 0)) ELSE 0 END as overdue,
        so.created_at
      FROM sales_orders so
      JOIN companies c ON so.company_id = c.id
      LEFT JOIN customer_pos cp_pos ON so.customer_po_id = cp_pos.id
      WHERE so.status NOT IN ('DRAFT', 'CANCELLED', 'PAID', 'CLOSED')

      UNION ALL

      -- From orders (Direct based)
      SELECT 
        c.company_name as name,
        '' as email,
        o.id,
        (o.grand_total - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = o.id AND sales_order_source = 'DIRECT_ORDER' AND status = 'CONFIRMED'), 0)) as outstanding,
        CASE WHEN o.created_at < DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY) THEN (o.grand_total - COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE sales_order_id = o.id AND sales_order_source = 'DIRECT_ORDER' AND status = 'CONFIRMED'), 0)) ELSE 0 END as overdue,
        o.created_at
      FROM orders o
      JOIN companies c ON o.client_id = c.id
      WHERE o.status NOT IN ('Closed', 'Cancelled', 'Paid', 'PAID', 'CANCELLED', 'CLOSED')
    ) combined
    WHERE outstanding > 0
    ${dateFilter.replace('created_at', 'combined.created_at')}
    ${customerFilter.replace('c.company_name', 'combined.name')}
    GROUP BY name, email
    ORDER BY outstanding DESC
    LIMIT 3
  `, [...params, ...(customer && customer !== 'All' && customer !== 'All Customers' ? [customer] : [])]);

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
    ${dateFilter.replace('created_at', 'po.created_at')}
    ${customerFilter.replace('c.company_name', 'v.vendor_name')}
    GROUP BY v.id
    ORDER BY outstanding DESC
    LIMIT 3
  `, [...params, ...(customer && customer !== 'All' && customer !== 'All Customers' ? [customer] : [])]);

  // 7. Recent Transactions
  const [recentTransactions] = await pool.query(`
    (SELECT 
      cp.id,
      'Payment Received' as type,
      cp.payment_receipt_no as reference,
      c.company_name as party,
      cp.payment_date as date,
      NULL as dueDate,
      cp.payment_amount as amount,
      cp.status,
      NULL as invoice_url
    FROM customer_payments cp
    JOIN companies c ON cp.customer_id = c.id
    WHERE 1=1 ${dateFilter.replace('created_at', 'cp.payment_date')} ${customerFilter}
    ORDER BY cp.payment_date DESC LIMIT 3)
    UNION ALL
    (SELECT 
      p.id,
      'Vendor Payment' as type,
      p.payment_voucher_no as reference,
      v.vendor_name as party,
      p.payment_date as date,
      NULL as dueDate,
      p.payment_amount as amount,
      p.status,
      NULL as invoice_url
    FROM payments p
    JOIN vendors v ON p.vendor_id = v.id
    WHERE 1=1 ${dateFilter.replace('created_at', 'p.payment_date')} ${customerFilter.replace('c.company_name', 'v.vendor_name')}
    ORDER BY p.payment_date DESC LIMIT 3)
    UNION ALL
    (SELECT 
      po.id,
      'Vendor Invoice' as type,
      po.po_number as reference,
      v.vendor_name as party,
      po.created_at as date,
      po.expected_delivery_date as dueDate,
      po.total_amount as amount,
      po.status,
      po.invoice_url
    FROM purchase_orders po
    JOIN vendors v ON po.vendor_id = v.id
    WHERE 1=1 ${dateFilter.replace('created_at', 'po.created_at')} ${customerFilter.replace('c.company_name', 'v.vendor_name')}
    ORDER BY po.created_at DESC LIMIT 3)
    ORDER BY date DESC
    LIMIT 10
  `, [
    ...params, ...(customer && customer !== 'All' && customer !== 'All Customers' ? [customer] : []),
    ...params, ...(customer && customer !== 'All' && customer !== 'All Customers' ? [customer] : []),
    ...params, ...(customer && customer !== 'All' && customer !== 'All Customers' ? [customer] : [])
  ]);

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
