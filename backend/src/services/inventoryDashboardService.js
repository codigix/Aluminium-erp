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
    WHERE so.status IN ('CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_APPROVED', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION')
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
      sb.item_code,
      sb.item_description,
      sb.unit,
      COALESCE(SUM(CASE WHEN sl.transaction_type IN ('GRN_IN', 'ADJUSTMENT', 'RETURN') THEN sl.quantity 
                        WHEN sl.transaction_type = 'OUT' THEN -sl.quantity ELSE 0 END), 0) as current_balance
    FROM stock_balance sb
    LEFT JOIN stock_ledger sl ON sb.item_code = sl.item_code
    GROUP BY sb.item_code, sb.item_description, sb.unit
    HAVING current_balance < 10
    ORDER BY current_balance ASC
  `);
  return items;
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
    WHERE q.id IS NULL OR q.status = 'PENDING'
    ORDER BY gi.grn_id DESC
  `);
  return items;
};

module.exports = {
  getIncomingOrders,
  getPendingGRNs,
  getLowStockItems,
  getQCPendingItems
};
