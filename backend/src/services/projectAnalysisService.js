const pool = require('../config/db');

const getProjectAnalysisStats = async () => {
  // 1. KPI Stats
  const [[kpiStats]] = await pool.query(`
    SELECT 
      COUNT(*) as totalProjects,
      COALESCE(SUM(CASE WHEN so.net_total > 0 THEN so.net_total ELSE cp.net_total END), 0) as estimatedRevenue,
      COALESCE(SUM(CASE WHEN so.status IN ('PRODUCTION_COMPLETED', 'QC_APPROVED', 'READY_FOR_SHIPMENT', 'SHIPPED', 'CLOSED') THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100, 0) as completionRate,
      SUM(CASE WHEN so.status NOT IN ('SHIPPED', 'CLOSED', 'CANCELLED') AND so.target_dispatch_date < CURRENT_DATE THEN 1 ELSE 0 END) as atRiskProjects
    FROM sales_orders so
    LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
    WHERE so.status != 'CANCELLED'
  `);

  // 2. Project List (Matrix Table)
  const [projectList] = await pool.query(`
    SELECT 
      so.id,
      so.project_name,
      c.company_name,
      so.status,
      so.target_dispatch_date,
      DATEDIFF(so.target_dispatch_date, CURRENT_DATE) as daysRemaining,
      COALESCE(CASE WHEN so.net_total > 0 THEN so.net_total ELSE cp.net_total END, 0) as revenue,
      (
        SELECT COUNT(*) 
        FROM work_orders 
        WHERE sales_order_id = so.id AND status = 'COMPLETED'
      ) as completedJobs,
      (
        SELECT COUNT(*) 
        FROM work_orders 
        WHERE sales_order_id = so.id
      ) as totalJobs,
      (SELECT COUNT(*) FROM workstations) as resourcesCount, -- Actual count from workstations table
      99 as yield -- Mock yield
    FROM sales_orders so
    LEFT JOIN companies c ON so.company_id = c.id
    LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
    WHERE so.status != 'CANCELLED'
    ORDER BY so.created_at DESC
    LIMIT 25
  `);

  // 3. Volume Distribution (Monthly Revenue)
  const [volumeDistribution] = await pool.query(`
    SELECT 
      DATE_FORMAT(month_list.month, '%b %Y') as name,
      COALESCE(SUM(CASE WHEN so.net_total > 0 THEN so.net_total ELSE cp.net_total END), 0) as revenue
    FROM (
      SELECT CURRENT_DATE - INTERVAL 5 MONTH as month UNION 
      SELECT CURRENT_DATE - INTERVAL 4 MONTH UNION 
      SELECT CURRENT_DATE - INTERVAL 3 MONTH UNION 
      SELECT CURRENT_DATE - INTERVAL 2 MONTH UNION 
      SELECT CURRENT_DATE - INTERVAL 1 MONTH UNION 
      SELECT CURRENT_DATE
    ) month_list
    LEFT JOIN sales_orders so ON DATE_FORMAT(so.created_at, '%Y-%m') = DATE_FORMAT(month_list.month, '%Y-%m') AND so.status != 'CANCELLED'
    LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
    GROUP BY month_list.month
    ORDER BY month_list.month ASC
  `);

  // 4. OEE Breakdown (Proxy metrics)
  const oeeMetrics = {
    oee: 75.5,
    availability: 85,
    performance: 92,
    quality: 96
  };

  return {
    kpis: {
      totalProjects: kpiStats.totalProjects || 0,
      estimatedRevenue: kpiStats.estimatedRevenue || 0,
      completionRate: Math.round(kpiStats.completionRate || 0),
      atRiskProjects: kpiStats.atRiskProjects || 0,
      oee: oeeMetrics.oee
    },
    projectList,
    volumeDistribution,
    oeeMetrics,
    insights: [
      { text: `${kpiStats.totalProjects} Projects currently active in the ecosystem.`, type: 'info' },
      { text: `${kpiStats.atRiskProjects} Projects are currently behind schedule and need attention.`, type: kpiStats.atRiskProjects > 0 ? 'warning' : 'success' },
      { text: `Overall completion rate is at ${Math.round(kpiStats.completionRate || 0)}%.`, type: 'info' }
    ]
  };
};

module.exports = {
  getProjectAnalysisStats
};
