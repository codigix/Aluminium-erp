const pool = require('../config/db');

const getIncomingOrders = async () => {
  const [salesOrders] = await pool.query(`
    SELECT 
      so.id,
      CONCAT('SO-', LPAD(so.id, 4, '0')) as order_code,
      c.company_name,
      so.project_name,
      cp.po_number,
      cp.po_date,
      cp.net_total as amount,
      so.target_dispatch_date,
      so.status,
      so.production_priority
    FROM sales_orders so
    LEFT JOIN companies c ON c.id = so.company_id
    LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
    WHERE so.status IN ('CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_Approved ', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION')
    ORDER BY so.created_at DESC
  `);
  return salesOrders;
};

const getPendingGRNs = async () => {
  const [grns] = await pool.query(`
    SELECT 
      g.id,
      g.po_number,
      g.grn_date,
      g.received_quantity,
      g.status
    FROM grns g
    WHERE g.status IN ('PENDING', 'RECEIVED')
    ORDER BY g.grn_date DESC
  `);
  return grns;
};

const getLowStockItems = async () => {
  const [items] = await pool.query(`
    SELECT 
      item_code,
      COALESCE(material_name, item_description) as item_description,
      unit,
      current_balance,
      warehouse
    FROM stock_balance
    WHERE current_balance < 10
    AND UPPER(material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
    ORDER BY current_balance ASC
  `);
  return items;
};

const getMaterialRequests = async () => {
  const [mrs] = await pool.query(`
    SELECT 
      mr.id,
      mr.mr_number as request_no,
      mr.purpose,
      mr.department,
      mr.required_by as required_date,
      mr.status,
      (SELECT COUNT(*) FROM material_request_items WHERE mr_id = mr.id) as items_count
    FROM material_requests mr
    ORDER BY mr.created_at DESC
    LIMIT 10
  `);
  return mrs;
};

const getQCPendingItems = async () => {
  const [items] = await pool.query(`
    SELECT 
      gi.grn_id,
      poi.item_code,
      gi.received_qty as quantity,
      COALESCE(q.status, 'PENDING') as status
    FROM grn_items gi
    JOIN purchase_order_items poi ON gi.po_item_id = poi.id
    LEFT JOIN qc_inspections q ON gi.grn_id = q.grn_id
    WHERE (q.id IS NULL OR q.status = 'PENDING')
    AND UPPER(poi.material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
    ORDER BY gi.grn_id DESC
  `);
  return items;
};

const getSummaryMetrics = async () => {
  const [stockStats] = await pool.query(`
    SELECT 
      COUNT(DISTINCT item_code) as total_items,
      SUM(current_balance) as total_stock_qty,
      SUM(current_balance * IFNULL(valuation_rate, 0)) as total_stock_value
    FROM stock_balance
    WHERE UPPER(material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
  `);

  const [mrStats] = await pool.query(`
    SELECT 
      COUNT(*) as total_mrs,
      SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as draft_mrs,
      SUM(CASE WHEN status = 'Approved ' THEN 1 ELSE 0 END) as approved_mrs,
      SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) as submitted_mrs
    FROM material_requests
  `);

  const [poStats] = await pool.query(`
    SELECT 
      COUNT(*) as total_pos,
      SUM(CASE WHEN status = 'ORDERED' THEN 1 ELSE 0 END) as ordered_pos,
      SUM(CASE WHEN status = 'PARTIALLY_RECEIVED' THEN 1 ELSE 0 END) as partial_pos,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_pos
    FROM purchase_orders
  `);

  return {
    stock: stockStats[0],
    materialRequests: mrStats[0],
    purchaseOrders: poStats[0]
  };
};

module.exports = {
  getIncomingOrders,
  getPendingGRNs,
  getLowStockItems,
  getQCPendingItems,
  getSummaryMetrics
};
