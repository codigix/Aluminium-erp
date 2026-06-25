const pool = require('../config/db');

const getProjectAnalysisStats = async () => {
  // 1. KPI Stats (Aggregated by Parent/Standalone)
  const [[kpiStats]] = await pool.query(`
    SELECT 
      COUNT(*) as totalProjects,
      COALESCE(SUM(revenue), 0) as estimatedRevenue,
      COALESCE(SUM(CASE WHEN status IN ('PRODUCTION_COMPLETED', 'QC_APPROVED', 'READY_FOR_SHIPMENT', 'SHIPPED', 'CLOSED', 'COMPLETED') THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100, 0) as completionRate,
      SUM(CASE WHEN status NOT IN ('SHIPPED', 'CLOSED', 'CANCELLED', 'COMPLETED') AND target_dispatch_date < CURRENT_DATE THEN 1 ELSE 0 END) as atRiskProjects,
      SUM(CASE WHEN status = 'READY_FOR_SHIPMENT' THEN 1 ELSE 0 END) as readyForShipment
    FROM (
      SELECT 
        so.id,
        COALESCE(so.net_total, cp.net_total, 0) as revenue,
        so.target_dispatch_date,
        COALESCE(
          (SELECT 
            CASE 
              WHEN COUNT(*) = 0 THEN NULL
              WHEN COUNT(*) = SUM(CASE WHEN status IN ('SHIPPED', 'CLOSED', 'COMPLETED') THEN 1 ELSE 0 END) THEN 'COMPLETED'
              WHEN SUM(CASE WHEN status = 'READY_FOR_SHIPMENT' THEN 1 ELSE 0 END) > 0 THEN 'READY_FOR_SHIPMENT'
              WHEN SUM(CASE WHEN status = 'QC_APPROVED' THEN 1 ELSE 0 END) > 0 THEN 'QC_APPROVED'
              WHEN SUM(CASE WHEN status = 'PRODUCTION_COMPLETED' THEN 1 ELSE 0 END) > 0 THEN 'PRODUCTION_COMPLETED'
              WHEN SUM(CASE WHEN status = 'IN_PRODUCTION' THEN 1 ELSE 0 END) > 0 THEN 'IN_PRODUCTION'
              WHEN SUM(CASE WHEN status = 'PROCUREMENT' THEN 1 ELSE 0 END) > 0 THEN 'PROCUREMENT'
              WHEN SUM(CASE WHEN status = 'BOM_SUBMITTED' THEN 1 ELSE 0 END) > 0 THEN 'BOM_SUBMITTED'
              WHEN SUM(CASE WHEN status = 'DESIGN_ENG' THEN 1 ELSE 0 END) > 0 THEN 'DESIGN_ENG'
              ELSE MAX(status)
            END
           FROM sales_orders WHERE parent_id = so.id AND status != 'CANCELLED'
          ),
          so.status
        ) as status
      FROM sales_orders so
      LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
      WHERE so.parent_id IS NULL 
      AND so.status != 'CANCELLED'
      AND NOT EXISTS (
        SELECT 1 FROM sales_orders so2 
        WHERE so.project_name LIKE CONCAT('%', so2.so_number, '%')
        AND so2.id != so.id
      )
    ) as aggregated_projects
  `);

  // 2. Project List (Matrix Table - Grouped by Parent)
  const [projectList] = await pool.query(`
    SELECT 
      so.id,
      COALESCE(
        NULLIF(TRIM(so.project_name), ''), 
        (SELECT project_name FROM orders WHERE id = so.id LIMIT 1),
        CONCAT('Project #', LPAD(so.id, 6, '0'))
      ) as project_name,
      (
        SELECT GROUP_CONCAT(DISTINCT drawing_no SEPARATOR ', ') 
        FROM (
          SELECT drawing_no FROM sales_order_items WHERE sales_order_id = so.id
          UNION
          SELECT drawing_no FROM sales_order_items WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = so.id)
        ) d_combined
      ) as drawing_nos,
      c.company_name,
      COALESCE(
        (SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN NULL
            WHEN COUNT(*) = SUM(CASE WHEN status IN ('SHIPPED', 'CLOSED', 'COMPLETED') THEN 1 ELSE 0 END) THEN 'COMPLETED'
            WHEN SUM(CASE WHEN status = 'READY_FOR_SHIPMENT' THEN 1 ELSE 0 END) > 0 THEN 'READY_FOR_SHIPMENT'
            WHEN SUM(CASE WHEN status = 'QC_APPROVED' THEN 1 ELSE 0 END) > 0 THEN 'QC_APPROVED'
            WHEN SUM(CASE WHEN status = 'PRODUCTION_COMPLETED' THEN 1 ELSE 0 END) > 0 THEN 'PRODUCTION_COMPLETED'
            WHEN SUM(CASE WHEN status = 'IN_PRODUCTION' THEN 1 ELSE 0 END) > 0 THEN 'IN_PRODUCTION'
            WHEN SUM(CASE WHEN status = 'PROCUREMENT' THEN 1 ELSE 0 END) > 0 THEN 'PROCUREMENT'
            WHEN SUM(CASE WHEN status = 'BOM_SUBMITTED' THEN 1 ELSE 0 END) > 0 THEN 'BOM_SUBMITTED'
            WHEN SUM(CASE WHEN status = 'DESIGN_ENG' THEN 1 ELSE 0 END) > 0 THEN 'DESIGN_ENG'
            ELSE MAX(status)
          END
         FROM sales_orders WHERE parent_id = so.id AND status != 'CANCELLED'
        ),
        so.status
      ) as status,
      COALESCE(so.target_dispatch_date, (SELECT delivery_date FROM orders WHERE id = so.id LIMIT 1)) as target_dispatch_date,
      DATEDIFF(COALESCE(so.target_dispatch_date, (SELECT delivery_date FROM orders WHERE id = so.id LIMIT 1)), CURRENT_DATE) as daysRemaining,
      COALESCE(
        NULLIF(so.net_total, 0), 
        (SELECT grand_total FROM orders WHERE id = so.id LIMIT 1),
        cp.net_total, 
        0
      ) as revenue,
      (
        SELECT COUNT(*) 
        FROM work_orders 
        WHERE (
          sales_order_id = so.id 
          OR sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = so.id)
          OR sales_order_id IN (SELECT id FROM orders WHERE id = so.id OR order_no = so.so_number) 
          OR plan_id IN (SELECT id FROM production_plans WHERE sales_order_id = so.id OR sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = so.id) OR sales_order_id IN (SELECT id FROM orders WHERE id = so.id OR order_no = so.so_number))
        ) AND status = 'COMPLETED'
      ) as completedJobs,
      (
        SELECT COUNT(*) 
        FROM work_orders 
        WHERE (
          sales_order_id = so.id 
          OR sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = so.id)
          OR sales_order_id IN (SELECT id FROM orders WHERE id = so.id OR order_no = so.so_number) 
          OR plan_id IN (SELECT id FROM production_plans WHERE sales_order_id = so.id OR sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = so.id) OR sales_order_id IN (SELECT id FROM orders WHERE id = so.id OR order_no = so.so_number))
        )
      ) as totalJobs,
      (SELECT COUNT(*) FROM workstations WHERE status = 'Active') as resourcesCount,
      COALESCE(
        (SELECT (SUM(accepted_qty) / NULLIF(SUM(produced_qty), 0)) * 100 
         FROM job_cards 
         WHERE work_order_id IN (
           SELECT id FROM work_orders 
           WHERE sales_order_id = so.id 
           OR sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = so.id)
           OR sales_order_id IN (SELECT id FROM orders WHERE id = so.id OR order_no = so.so_number)
           OR plan_id IN (SELECT id FROM production_plans WHERE sales_order_id = so.id OR sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = so.id) OR sales_order_id IN (SELECT id FROM orders WHERE id = so.id OR order_no = so.so_number))
         )),
        100
      ) as yield
    FROM sales_orders so
    LEFT JOIN companies c ON so.company_id = c.id
    LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
    WHERE so.parent_id IS NULL 
    AND so.status != 'CANCELLED'
    -- Also filter out implicit children that mention another SO in their name
    AND NOT EXISTS (
      SELECT 1 FROM sales_orders so2 
      WHERE so.project_name LIKE CONCAT('%', so2.so_number, '%')
      AND so2.id != so.id
    )
    ORDER BY so.created_at DESC
    LIMIT 25
  `);

  // 3. Volume Distribution (Monthly Revenue - Aggregated)
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
    LEFT JOIN sales_orders so ON DATE_FORMAT(so.created_at, '%Y-%m') = DATE_FORMAT(month_list.month, '%Y-%m') 
      AND so.status != 'CANCELLED' 
      AND so.parent_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM sales_orders so2 
        WHERE so.project_name LIKE CONCAT('%', so2.so_number, '%')
        AND so2.id != so.id
      )
    LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
    GROUP BY month_list.month
    ORDER BY month_list.month ASC
  `);

  // 4. OEE Breakdown (Plant-wide proxy for this page)
  const [oeeRows] = await pool.query(`
    SELECT 
      AVG(availability) as a,
      AVG(performance) as p,
      AVG(quality) as q
    FROM (
      SELECT 
        85.5 as availability,
        78.2 as performance,
        98.4 as quality
      FROM workstations WHERE status = 'Active'
    ) as mock -- For plant level, we use the same calculation as Machine Analysis
  `);

  const oeeMetrics = {
    oee: ((oeeRows[0].a * oeeRows[0].p * oeeRows[0].q) / 10000).toFixed(1),
    availability: Math.round(oeeRows[0].a),
    performance: Math.round(oeeRows[0].p),
    quality: Math.round(oeeRows[0].q)
  };

  // 5. Status Breakdown (Aggregated)
  const [statusBreakdown] = await pool.query(`
    SELECT status as name, COUNT(*) as value 
    FROM (
      SELECT 
        COALESCE(
          (SELECT 
            CASE 
              WHEN COUNT(*) = 0 THEN NULL
              WHEN COUNT(*) = SUM(CASE WHEN status IN ('SHIPPED', 'CLOSED', 'COMPLETED') THEN 1 ELSE 0 END) THEN 'COMPLETED'
              WHEN SUM(CASE WHEN status = 'READY_FOR_SHIPMENT' THEN 1 ELSE 0 END) > 0 THEN 'READY_FOR_SHIPMENT'
              WHEN SUM(CASE WHEN status = 'QC_APPROVED' THEN 1 ELSE 0 END) > 0 THEN 'QC_APPROVED'
              WHEN SUM(CASE WHEN status = 'PRODUCTION_COMPLETED' THEN 1 ELSE 0 END) > 0 THEN 'PRODUCTION_COMPLETED'
              WHEN SUM(CASE WHEN status = 'IN_PRODUCTION' THEN 1 ELSE 0 END) > 0 THEN 'IN_PRODUCTION'
              WHEN SUM(CASE WHEN status = 'PROCUREMENT' THEN 1 ELSE 0 END) > 0 THEN 'PROCUREMENT'
              WHEN SUM(CASE WHEN status = 'BOM_SUBMITTED' THEN 1 ELSE 0 END) > 0 THEN 'BOM_SUBMITTED'
              WHEN SUM(CASE WHEN status = 'DESIGN_ENG' THEN 1 ELSE 0 END) > 0 THEN 'DESIGN_ENG'
              ELSE MAX(status)
            END
           FROM sales_orders WHERE parent_id = so.id AND status != 'CANCELLED'
          ),
          so.status
        ) as status
      FROM sales_orders so
      WHERE so.parent_id IS NULL 
      AND so.status != 'CANCELLED'
      AND NOT EXISTS (
        SELECT 1 FROM sales_orders so2 
        WHERE so.project_name LIKE CONCAT('%', so2.so_number, '%')
        AND so2.id != so.id
      )
    ) as aggregated
    GROUP BY status
  `);

  // 6. Timeline Data (Monthly project creation/completion - Aggregated)
  const [timelineData] = await pool.query(`
    SELECT 
      DATE_FORMAT(month_list.month, '%b') as name,
      COUNT(DISTINCT so.id) as production,
      COUNT(DISTINCT so_comp.id) as forecast 
    FROM (
      SELECT CURRENT_DATE - INTERVAL 5 MONTH as month UNION 
      SELECT CURRENT_DATE - INTERVAL 4 MONTH UNION 
      SELECT CURRENT_DATE - INTERVAL 3 MONTH UNION 
      SELECT CURRENT_DATE - INTERVAL 2 MONTH UNION 
      SELECT CURRENT_DATE - INTERVAL 1 MONTH UNION 
      SELECT CURRENT_DATE
    ) month_list
    LEFT JOIN sales_orders so ON DATE_FORMAT(so.created_at, '%Y-%m') = DATE_FORMAT(month_list.month, '%Y-%m') 
      AND so.status != 'CANCELLED'
      AND so.parent_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM sales_orders so2 
        WHERE so.project_name LIKE CONCAT('%', so2.so_number, '%')
        AND so2.id != so.id
      )
    LEFT JOIN sales_orders so_comp ON DATE_FORMAT(so_comp.updated_at, '%Y-%m') = DATE_FORMAT(month_list.month, '%Y-%m') 
      AND so_comp.status IN ('SHIPPED', 'CLOSED', 'COMPLETED')
      AND so_comp.parent_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM sales_orders so2 
        WHERE so_comp.project_name LIKE CONCAT('%', so2.so_number, '%')
        AND so2.id != so_comp.id
      )
    GROUP BY month_list.month
    ORDER BY month_list.month ASC
  `);

  return {
    kpis: {
      totalProjects: kpiStats.totalProjects || 0,
      estimatedRevenue: kpiStats.estimatedRevenue || 0,
      completionRate: Math.round(kpiStats.completionRate || 0),
      atRiskProjects: kpiStats.atRiskProjects || 0,
      readyForShipment: kpiStats.readyForShipment || 0,
      oee: oeeMetrics.oee
    },
    projectList,
    volumeDistribution,
    oeeMetrics,
    statusBreakdown,
    timelineData,
    insights: [
      { text: `${kpiStats.totalProjects} Projects currently active in the ecosystem.`, type: 'info' },
      { text: `${kpiStats.atRiskProjects} Projects are currently behind schedule and need attention.`, type: kpiStats.atRiskProjects > 0 ? 'warning' : 'success' },
      { text: `Overall completion rate is at ${Math.round(kpiStats.completionRate || 0)}%.`, type: 'info' }
    ]
  };
};

const getProjectDetailAnalysis = async (salesOrderId) => {
  // 1. Project Info (Aggregated status for detail view)
  const [[projectInfo]] = await pool.query(`
    SELECT 
      so.*, 
      COALESCE(NULLIF(TRIM(so.project_name), ''), (SELECT project_name FROM orders WHERE id = so.id LIMIT 1)) as project_name,
      COALESCE(NULLIF(so.net_total, 0), (SELECT grand_total FROM orders WHERE id = so.id LIMIT 1), 0) as net_total,
      COALESCE(so.target_dispatch_date, (SELECT delivery_date FROM orders WHERE id = so.id LIMIT 1)) as target_dispatch_date,
      COALESCE(
        (SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN NULL
            WHEN COUNT(*) = SUM(CASE WHEN status IN ('SHIPPED', 'CLOSED', 'COMPLETED') THEN 1 ELSE 0 END) THEN 'COMPLETED'
            WHEN SUM(CASE WHEN status = 'READY_FOR_SHIPMENT' THEN 1 ELSE 0 END) > 0 THEN 'READY_FOR_SHIPMENT'
            WHEN SUM(CASE WHEN status = 'QC_APPROVED' THEN 1 ELSE 0 END) > 0 THEN 'QC_APPROVED'
            WHEN SUM(CASE WHEN status = 'PRODUCTION_COMPLETED' THEN 1 ELSE 0 END) > 0 THEN 'PRODUCTION_COMPLETED'
            WHEN SUM(CASE WHEN status = 'IN_PRODUCTION' THEN 1 ELSE 0 END) > 0 THEN 'IN_PRODUCTION'
            WHEN SUM(CASE WHEN status = 'PROCUREMENT' THEN 1 ELSE 0 END) > 0 THEN 'PROCUREMENT'
            WHEN SUM(CASE WHEN status = 'BOM_SUBMITTED' THEN 1 ELSE 0 END) > 0 THEN 'BOM_SUBMITTED'
            WHEN SUM(CASE WHEN status = 'DESIGN_ENG' THEN 1 ELSE 0 END) > 0 THEN 'DESIGN_ENG'
            ELSE MAX(status)
          END
         FROM sales_orders WHERE parent_id = so.id AND status != 'CANCELLED'
        ),
        so.status
      ) as status,
      c.company_name,
      COALESCE(cp.po_number, (
        SELECT p.po_number 
        FROM customer_pos p
        JOIN customer_po_items pi ON p.id = pi.customer_po_id
        JOIN sales_order_items si ON (TRIM(pi.drawing_no) = TRIM(si.drawing_no) AND si.drawing_no IS NOT NULL)
        WHERE si.sales_order_id = so.id
        LIMIT 1
      )) as customer_po_no,
      (SELECT COUNT(*) FROM work_orders WHERE 
        sales_order_id = so.id 
        OR sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = so.id) 
        OR sales_order_id IN (SELECT id FROM orders WHERE id = so.id OR order_no = so.so_number) 
        OR plan_id IN (SELECT id FROM production_plans WHERE sales_order_id = so.id OR sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = so.id) OR sales_order_id IN (SELECT id FROM orders WHERE id = so.id OR order_no = so.so_number))
        OR sales_order_item_id IN (SELECT id FROM sales_order_items WHERE sales_order_id = so.id)
      ) as total_work_orders,
      (SELECT COUNT(*) FROM work_orders WHERE (
        sales_order_id = so.id 
        OR sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = so.id) 
        OR sales_order_id IN (SELECT id FROM orders WHERE id = so.id OR order_no = so.so_number) 
        OR plan_id IN (SELECT id FROM production_plans WHERE sales_order_id = so.id OR sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = so.id) OR sales_order_id IN (SELECT id FROM orders WHERE id = so.id OR order_no = so.so_number))
        OR sales_order_item_id IN (SELECT id FROM sales_order_items WHERE sales_order_id = so.id)
      ) AND status = 'COMPLETED') as completed_work_orders
    FROM sales_orders so
    LEFT JOIN companies c ON so.company_id = c.id
    LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
    WHERE so.id = ?
  `, [salesOrderId]);

  if (!projectInfo) throw new Error('Project not found');

  const projectName = projectInfo.project_name;
  const customerPoId = projectInfo.customer_po_id;

  // Helper: Get all linked work order IDs (via SO, plan, or SO items)
  const [linkedWoIdRows] = await pool.query(`
    SELECT id FROM work_orders 
    WHERE sales_order_id = ? 
    OR sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = ?)
    OR sales_order_id IN (SELECT id FROM orders WHERE id = ? OR order_no = (SELECT so_number FROM sales_orders WHERE id = ?))
    OR plan_id IN (SELECT id FROM production_plans WHERE sales_order_id = ? OR sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = ?) OR sales_order_id IN (SELECT id FROM orders WHERE id = ? OR order_no = (SELECT so_number FROM sales_orders WHERE id = ?)))
    OR sales_order_item_id IN (SELECT id FROM sales_order_items WHERE sales_order_id = ?)
  `, [salesOrderId, salesOrderId, salesOrderId, salesOrderId, salesOrderId, salesOrderId, salesOrderId, salesOrderId, salesOrderId]);
  
  const linkedWoIds = linkedWoIdRows.map(r => r.id);

  // 2. Production Flow (Grouped by Operation Name across all work orders including children)
  const [productionFlow] = linkedWoIds.length > 0 ? await pool.query(`
    SELECT 
      jc.operation_name as item_name,
      CASE 
        WHEN SUM(CASE WHEN jc.status = 'COMPLETED' THEN 1 ELSE 0 END) = COUNT(*) THEN 'COMPLETED'
        WHEN SUM(CASE WHEN jc.status = 'PENDING' THEN 1 ELSE 0 END) = COUNT(*) THEN 'PENDING'
        ELSE 'IN_PROGRESS'
      END as status,
      SUM(jc.planned_qty) as planned_qty,
      SUM(jc.produced_qty) as produced_qty,
      SUM(jc.accepted_qty) as accepted_qty,
      SUM(jc.rejected_qty) as rejected_qty,
      MAX(jc.end_time) as target_date,
      COUNT(*) as total_job_cards,
      SUM(CASE WHEN jc.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_job_cards,
      COALESCE((SUM(jc.accepted_qty) / NULLIF(SUM(jc.produced_qty), 0)) * 100, 100) as yield
    FROM job_cards jc
    WHERE jc.work_order_id IN (?)
    GROUP BY jc.operation_name
    ORDER BY MIN(jc.sequence_no)
  `, [linkedWoIds]) : [[]];

  // 3. Work Orders Detail (Including children + linked via SO items)
  const [workOrders] = linkedWoIds.length > 0 ? await pool.query(`
    SELECT 
      wo.id,
      wo.wo_number as work_order_no,
      wo.item_name,
      wo.quantity as planned_qty,
      (SELECT SUM(produced_qty) FROM job_cards WHERE work_order_id = wo.id) as produced_qty,
      wo.status,
      wo.end_date as target_date,
      wo.sales_order_id
    FROM work_orders wo 
    WHERE wo.id IN (?)
  `, [linkedWoIds]) : [[]];

  // 4. Logistics (Shipments - Including children + by SO item)
  const [logistics] = await pool.query(`
    SELECT 
      s.*,
      dc.challan_number as challan_no,
      COALESCE((SELECT SUM(quantity) FROM delivery_challan_items WHERE challan_id = dc.id), 0) as shipped_qty
    FROM shipment_orders s
    LEFT JOIN delivery_challans dc ON s.id = dc.shipment_id
    WHERE s.sales_order_id = ? 
    OR s.sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = ?)
    OR (? IS NOT NULL AND s.sales_order_item_id IN (SELECT id FROM sales_order_items WHERE sales_order_id = ?))
  `, [salesOrderId, salesOrderId, salesOrderId, salesOrderId]);

  // 5. Supply Chain (Material Requests - Including children)
  const [supplyChain] = await pool.query(`
    SELECT 
      mr.*,
      mr.mr_number as mr_no,
      mr.department as department_name
    FROM material_requests mr
    LEFT JOIN production_plans pp ON mr.plan_id = pp.id
    WHERE (pp.sales_order_id = ? OR pp.sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = ?) OR mr.notes LIKE CONCAT('%', ?, '%') OR mr.purpose LIKE CONCAT('%', ?, '%'))
    ORDER BY mr.created_at DESC
  `, [salesOrderId, salesOrderId, projectName, projectName]);

  // 6. Purchase Orders (via sales_order_id linkage)
  const [purchaseOrders] = await pool.query(`
    SELECT 
      po.id,
      po.po_number,
      po.status,
      po.created_at,
      v.vendor_name,
      (SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id = po.id) as item_count,
      (SELECT SUM(total_amount) FROM purchase_order_items WHERE purchase_order_id = po.id) as total_value
    FROM purchase_orders po
    LEFT JOIN vendors v ON po.vendor_id = v.id
    WHERE po.sales_order_id = ?
    ORDER BY po.created_at DESC
  `, [salesOrderId]);

  // 7. GRNs (via po_receipt -> purchase_order -> sales_order_id)
  const [grns] = await pool.query(`
    SELECT 
      g.id,
      g.po_number,
      g.grn_date,
      g.received_quantity,
      g.status,
      pr.po_id,
      po.po_number as linked_po_number,
      v.vendor_name
    FROM grns g
    JOIN po_receipts pr ON g.po_receipt_id = pr.id
    JOIN purchase_orders po ON pr.po_id = po.id
    LEFT JOIN vendors v ON po.vendor_id = v.id
    WHERE po.sales_order_id = ?
    ORDER BY g.grn_date DESC
  `, [salesOrderId]);

  // 8. QC Inspections (via GRN -> PO -> sales_order_id)
  const [qcInspections] = await pool.query(`
    SELECT 
      qi.id,
      qi.inspection_date,
      qi.pass_quantity,
      qi.fail_quantity,
      qi.status,
      qi.remarks,
      g.po_number,
      g.received_quantity
    FROM qc_inspections qi
    JOIN grns g ON qi.grn_id = g.id
    JOIN po_receipts pr ON g.po_receipt_id = pr.id
    JOIN purchase_orders po ON pr.po_id = po.id
    WHERE po.sales_order_id = ?
    ORDER BY qi.inspection_date DESC
  `, [salesOrderId]);

  // 9. Stock Movements for this project
  const [stockMovements] = await pool.query(`
    SELECT sl.*, sl.material_name as item_name
    FROM stock_ledger sl
    WHERE sl.reference_doc_id IN (
        SELECT mr.id 
        FROM material_requests mr
        LEFT JOIN production_plans pp ON mr.plan_id = pp.id
        WHERE (pp.sales_order_id = ? OR pp.sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = ?) OR mr.notes LIKE CONCAT('%', ?, '%') OR mr.purpose LIKE CONCAT('%', ?, '%'))
    ) AND sl.reference_doc_type = 'Material Request'
    ORDER BY sl.transaction_date DESC
  `, [salesOrderId, salesOrderId, projectName, projectName]);

  // 10. Inventory Matrix (Stock Balance items for this project)
  const [inventoryMatrix] = await pool.query(`
    SELECT 
      sb.material_name as item_name,
      sb.item_code,
      sb.unit,
      sb.current_balance as available_qty,
      (SELECT SUM(quantity) FROM material_request_items WHERE mr_id IN (
          SELECT mr.id 
          FROM material_requests mr
          LEFT JOIN production_plans pp ON mr.plan_id = pp.id
          WHERE (pp.sales_order_id = ? OR pp.sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = ?) OR mr.notes LIKE CONCAT('%', ?, '%') OR mr.purpose LIKE CONCAT('%', ?, '%'))
      ) AND item_code = sb.item_code) as required_qty
    FROM stock_balance sb
    WHERE sb.item_code IN (
      SELECT item_code FROM material_request_items WHERE mr_id IN (
          SELECT mr.id 
          FROM material_requests mr
          LEFT JOIN production_plans pp ON mr.plan_id = pp.id
          WHERE (pp.sales_order_id = ? OR pp.sales_order_id IN (SELECT id FROM sales_orders WHERE parent_id = ?) OR mr.notes LIKE CONCAT('%', ?, '%') OR mr.purpose LIKE CONCAT('%', ?, '%'))
      )
    )
  `, [salesOrderId, salesOrderId, projectName, projectName, salesOrderId, salesOrderId, projectName, projectName]);

  // 11. Machine Utilization for this project
  const [machineUtilization] = linkedWoIds.length > 0 ? await pool.query(`
    SELECT 
      w.workstation_name as n,
      COUNT(jc.id) as jobs_count,
      COALESCE(AVG(jc.produced_qty / NULLIF(jc.planned_qty, 0) * 100), 0) as v
    FROM job_cards jc
    JOIN workstations w ON jc.workstation_id = w.id
    WHERE jc.work_order_id IN (?)
    GROUP BY w.id
  `, [linkedWoIds]) : [[]];

  // 12. Production Logs (Time logs)
  const [productionLogs] = linkedWoIds.length > 0 ? await pool.query(`
    SELECT 
      tl.id,
      tl.log_date as date,
      wo.wo_number as work_order,
      jc.operation_name as operation,
      tl.produced_qty as quantity
    FROM job_card_time_logs tl
    JOIN job_cards jc ON tl.job_card_id = jc.id
    JOIN work_orders wo ON jc.work_order_id = wo.id
    WHERE wo.id IN (?)
    ORDER BY tl.log_date DESC, tl.created_at DESC
    LIMIT 50
  `, [linkedWoIds]) : [[]];

  // 13. Machine Efficiency for this project
  const [machineEfficiency] = linkedWoIds.length > 0 ? await pool.query(`
    SELECT 
      w.workstation_name as name,
      w.workstation_code,
      COALESCE(SUM(TIMESTAMPDIFF(SECOND, tl.start_time, tl.end_time)) / 3600, 0) as working_hrs,
      COALESCE((
        SELECT SUM(TIMESTAMPDIFF(SECOND, dtl.start_time, dtl.end_time)) / 3600 
        FROM job_card_downtime_logs dtl 
        JOIN job_cards jc2 ON dtl.job_card_id = jc2.id
        WHERE jc2.workstation_id = w.id AND jc2.work_order_id IN (?)
      ), 0) as downtime_hrs,
      COALESCE(
        (SUM(tl.produced_qty) / NULLIF(SUM(DISTINCT jc.planned_qty), 0)) * 100,
        85
      ) as efficiency
    FROM workstations w
    JOIN job_cards jc ON w.id = jc.workstation_id
    LEFT JOIN job_card_time_logs tl ON jc.id = tl.job_card_id
    WHERE jc.work_order_id IN (?)
    GROUP BY w.id
  `, [linkedWoIds, linkedWoIds]) : [[]];

  // 14. Child Orders (Broadened search via client + naming patterns)
  const [childOrders] = await pool.query(`
    SELECT id, so_number, status, project_name, created_at, target_dispatch_date
    FROM sales_orders
    WHERE (
      parent_id = ? 
      OR (
        company_id = ? 
        AND (
          project_name LIKE CONCAT('%', ?, '%') 
          OR project_name LIKE CONCAT('%', (SELECT so_number FROM sales_orders WHERE id = ?), '%')
        )
        AND id != ?
      )
    )
    AND status != 'CANCELLED'
  `, [salesOrderId, projectInfo.company_id, projectName, salesOrderId, salesOrderId]);

  // 15. Sales Order Items (for Overview display)
  const [soItems] = await pool.query(`
    SELECT id, drawing_no, item_code, description, quantity, rate as unit_price, status
    FROM sales_order_items
    WHERE sales_order_id = ?
    ORDER BY id ASC
  `, [salesOrderId]);

  return {
    projectInfo,
    productionFlow,
    workOrders,
    logistics,
    supplyChain,
    purchaseOrders,
    grns,
    qcInspections,
    stockMovements,
    inventoryMatrix,
    machineUtilization,
    productionLogs,
    machineEfficiency,
    childOrders,
    soItems
  };
};

const getMaterialConsumptionStats = async () => {
  const [projectList] = await pool.query(`
    SELECT 
      so.id,
      so.project_name,
      c.company_name,
      so.status,
      (SELECT GROUP_CONCAT(DISTINCT drawing_no SEPARATOR ', ') FROM sales_order_items WHERE sales_order_id = so.id) as drawing_nos,
      (SELECT GROUP_CONCAT(DISTINCT description SEPARATOR ', ') FROM sales_order_items WHERE sales_order_id = so.id) as item_descriptions,
      (
        SELECT SUM(mri.quantity) 
        FROM material_request_items mri 
        JOIN material_requests mr ON mri.mr_id = mr.id
        LEFT JOIN production_plans pp ON mr.plan_id = pp.id
        WHERE (pp.sales_order_id = so.id OR mr.notes LIKE CONCAT('%', so.project_name, '%') OR mr.purpose LIKE CONCAT('%', so.project_name, '%'))
        AND mr.status NOT IN ('CANCELLED', 'REJECTED')
      ) as allocated_qty,
      (
        SELECT SUM(mri.quantity) 
        FROM material_request_items mri 
        JOIN material_requests mr ON mri.mr_id = mr.id
        LEFT JOIN production_plans pp ON mr.plan_id = pp.id
        WHERE (pp.sales_order_id = so.id OR mr.notes LIKE CONCAT('%', so.project_name, '%') OR mr.purpose LIKE CONCAT('%', so.project_name, '%'))
        AND mr.status IN ('COMPLETED', 'FULFILLED')
      ) as consumed_qty,
      COALESCE(
        (SELECT (SUM(accepted_qty) / NULLIF(SUM(produced_qty), 0)) * 100 
         FROM job_cards 
         WHERE work_order_id IN (SELECT id FROM work_orders WHERE sales_order_id = so.id)),
        100
      ) as yield
    FROM sales_orders so
    LEFT JOIN companies c ON so.company_id = c.id
    WHERE so.status != 'CANCELLED' 
    AND so.parent_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM sales_orders so2 
      WHERE so.project_name LIKE CONCAT('%', so2.so_number, '%')
      AND so2.id != so.id
    )
    ORDER BY so.created_at DESC
  `);

  return {
    projectList: projectList.map(p => ({
      ...p,
      allocated_qty: parseFloat(p.allocated_qty || 0),
      consumed_qty: parseFloat(p.consumed_qty || 0),
      remaining_qty: Math.max(0, parseFloat(p.allocated_qty || 0) - parseFloat(p.consumed_qty || 0)),
      efficiency: p.yield || 100
    }))
  };
};

module.exports = {
  getProjectAnalysisStats,
  getProjectDetailAnalysis,
  getMaterialConsumptionStats
};
