const pool = require('../config/db');
const bomService = require('./bomService');

const listProductionPlans = async () => {
  const [rows] = await pool.query(
    `SELECT pp.*, u.username as creator_name
     FROM production_plans pp
     LEFT JOIN users u ON pp.created_by = u.id
     ORDER BY pp.created_at DESC`
  );
  return rows;
};

const getProductionPlanById = async (id) => {
  const [plans] = await pool.query(
    `SELECT pp.*, u.username as creator_name
     FROM production_plans pp
     LEFT JOIN users u ON pp.created_by = u.id
     WHERE pp.id = ?`,
    [id]
  );

  if (plans.length === 0) return null;

  const plan = plans[0];

  const [items] = await pool.query(
    `SELECT ppi.*, so.project_name, soi.item_code, soi.description, soi.drawing_no, w.workstation_name
     FROM production_plan_items ppi
     JOIN sales_orders so ON ppi.sales_order_id = so.id
     JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
     LEFT JOIN workstations w ON ppi.workstation_id = w.id
     WHERE ppi.plan_id = ?`,
    [id]
  );

  plan.items = items;
  return plan;
};

const createProductionPlan = async (planData, createdBy) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { planCode, planDate, startDate, endDate, remarks, items } = planData;

    const [result] = await connection.execute(
      `INSERT INTO production_plans (plan_code, plan_date, start_date, end_date, remarks, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PLANNED')`,
      [planCode, planDate, startDate, endDate, remarks, createdBy]
    );

    const planId = result.insertId;

    for (const item of items) {
      await connection.execute(
        `INSERT INTO production_plan_items 
         (plan_id, sales_order_id, sales_order_item_id, planned_qty, workstation_id, planned_start_date, planned_end_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          planId,
          item.salesOrderId,
          item.salesOrderItemId,
          item.plannedQty,
          item.workstationId || null,
          item.plannedStartDate || startDate,
          item.plannedEndDate || endDate
        ]
      );

      // Update Sales Order status to IN_PRODUCTION if it's not already
      await connection.execute(
        `UPDATE sales_orders SET status = 'IN_PRODUCTION', current_department = 'PRODUCTION' WHERE id = ?`,
        [item.salesOrderId]
      );
    }

    await connection.commit();
    return planId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getReadySalesOrderItems = async () => {
  // Items that are approved and ready for production
  // We pick the LATEST item for each drawing_no to avoid showing old revisions
  const [rows] = await pool.query(
    `SELECT so.id as sales_order_id, 
            COALESCE(o.order_no, CONCAT('SO-', so.id)) as order_no, 
            so.project_name, 
            so.production_priority, 
            so.created_at,
            soi.id as sales_order_item_id, 
            soi.item_code as item_code, 
            soi.item_type as item_type,
            soi.drawing_no as drawing_no,
            soi.description as description, 
            soi.quantity as total_qty, 
            soi.unit as unit,
            COALESCE(planned.already_planned_qty, 0) as already_planned_qty
     FROM (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY sales_order_id, drawing_no ORDER BY id DESC) as rn
       FROM sales_order_items
       WHERE status != 'Rejected' AND (item_type IN ('FG', 'SFG'))
     ) soi
     JOIN sales_orders so ON soi.sales_order_id = so.id
     LEFT JOIN (
       SELECT quotation_id, order_no FROM orders 
       WHERE id IN (SELECT MAX(id) FROM orders GROUP BY quotation_id)
     ) o ON o.quotation_id = so.id
     LEFT JOIN (
       SELECT sales_order_item_id, SUM(planned_qty) as already_planned_qty
       FROM production_plan_items 
       WHERE status != 'CANCELLED'
       GROUP BY sales_order_item_id
     ) planned ON soi.id = planned.sales_order_item_id
     WHERE soi.rn = 1
       AND (COALESCE(planned.already_planned_qty, 0) < soi.quantity)
     ORDER BY so.production_priority DESC, so.created_at ASC`
  );
  return rows;
};

const getProductionReadySalesOrders = async () => {
  const [rows] = await pool.query(
    `SELECT so.id, 
            COALESCE(MAX(o.order_no), CONCAT('SO-', so.id)) as order_no, 
            so.project_name, 
            cp.po_number, 
            c.company_name, 
            so.created_at
     FROM sales_orders so
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
     LEFT JOIN orders o ON o.quotation_id = so.id
     WHERE EXISTS (
       SELECT 1 FROM (
         SELECT sales_order_id, drawing_no, ROW_NUMBER() OVER (PARTITION BY sales_order_id, drawing_no ORDER BY id DESC) as rn
         FROM sales_order_items
         WHERE status != 'Rejected' AND (item_type IN ('FG', 'SFG'))
       ) soi 
       WHERE soi.sales_order_id = so.id AND soi.rn = 1
     )
     GROUP BY so.id, so.project_name, cp.po_number, c.company_name, so.created_at
     ORDER BY so.created_at DESC`
  );
  return rows;
};

const getSalesOrderFullDetails = async (id) => {
  const [orders] = await pool.query(
    `SELECT so.*, c.company_name, cp.po_number, COALESCE(o.order_no, CONCAT('SO-', so.id)) as order_no
     FROM sales_orders so
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
     LEFT JOIN (
       SELECT quotation_id, order_no FROM orders 
       WHERE quotation_id = ? ORDER BY id DESC LIMIT 1
     ) o ON o.quotation_id = so.id
     WHERE so.id = ?`,
    [id, id]
  );

  if (orders.length === 0) return null;
  const order = orders[0];

  const [items] = await pool.query(
    `SELECT soi.id,
            soi.id as sales_order_item_id,
            soi.sales_order_id,
            soi.item_code as item_code,
            soi.item_type as item_type,
            soi.drawing_no as drawing_no,
            soi.description,
            soi.quantity as quantity,
            soi.unit,
            soi.status,
            soi.rejection_reason,
            COALESCE(planned.already_planned_qty, 0) as already_planned_qty
     FROM (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY sales_order_id, drawing_no ORDER BY id DESC) as rn
       FROM sales_order_items
       WHERE sales_order_id = ? AND (item_type IN ('FG', 'SFG'))
     ) soi
     LEFT JOIN (
       SELECT sales_order_item_id, SUM(planned_qty) as already_planned_qty
       FROM production_plan_items 
       WHERE status != 'CANCELLED'
       GROUP BY sales_order_item_id
     ) planned ON soi.id = planned.sales_order_item_id
     WHERE soi.rn = 1`,
    [id]
  );

  order.items = items;
  return order;
};

const generatePlanCode = async () => {
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM production_plans');
  const count = rows[0].count + 1;
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `PP-${year}${month}-${count.toString().padStart(4, '0')}`;
};

const getItemBOMDetails = async (salesOrderItemId) => {
  // Fetch the item details first to get item_code and drawing_no
  const [items] = await pool.query(
    'SELECT id, item_code, drawing_no FROM sales_order_items WHERE id = ? AND item_type IN ("FG", "SFG")',
    [salesOrderItemId]
  );

  if (items.length === 0) return null;
  const item = items[0];

  // 1. Fetch ALL materials, components, and operations for this sales_order_item_id
  const [allMaterials] = await pool.query(
    'SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = ? ORDER BY created_at ASC',
    [salesOrderItemId]
  );
  const [allComponents] = await pool.query(
    'SELECT * FROM sales_order_item_components WHERE sales_order_item_id = ? ORDER BY created_at ASC',
    [salesOrderItemId]
  );
  const [allOperations] = await pool.query(
    'SELECT * FROM sales_order_item_operations WHERE sales_order_item_id = ? ORDER BY created_at ASC',
    [salesOrderItemId]
  );

  // If no data found by sales_order_item_id, fallback to Master BOM by item_code or drawing_no
  if (allMaterials.length === 0 && allComponents.length === 0 && allOperations.length === 0) {
    const fallbackMaterials = await bomService.getItemMaterials(null, item.item_code, item.drawing_no);
    const fallbackComponents = await bomService.getItemComponents(null, item.item_code, item.drawing_no);
    const fallbackOperations = await bomService.getItemOperations(null, item.item_code, item.drawing_no);

    // If Master BOM found, we need to build a tree from it
    // But for simplicity and to match user expectation, we return the top-level
    // and build the tree using a recursive helper if needed.
    
    const buildTree = (materials, components, operations, parentId = null) => {
      const levelMaterials = materials.filter(m => String(m.parent_id) === String(parentId));
      const levelComponents = components.filter(c => String(c.parent_id) === String(parentId));
      const levelOperations = operations; // Operations usually apply to the whole item or are top-level

      const treeComponents = levelComponents.map(comp => ({
        ...comp,
        ...buildTree(materials, components, operations, comp.id)
      }));

      return {
        materials: levelMaterials,
        components: treeComponents,
        operations: parentId === null ? levelOperations : [] // Only return operations at top level for now
      };
    };

    return buildTree(fallbackMaterials, fallbackComponents, fallbackOperations, null);
  }

  // 2. Build tree from SO-specific data
  const buildTree = (materials, components, operations, parentId = null) => {
    const levelMaterials = materials.filter(m => String(m.parent_id) === String(parentId));
    const levelComponents = components.filter(c => String(c.parent_id) === String(parentId));
    
    const treeComponents = levelComponents.map(comp => ({
      ...comp,
      ...buildTree(materials, components, operations, comp.id)
    }));

    return {
      materials: levelMaterials,
      components: treeComponents,
      operations: parentId === null ? operations : []
    };
  };

  return buildTree(allMaterials, allComponents, allOperations, null);
};

module.exports = {
  listProductionPlans,
  getProductionPlanById,
  createProductionPlan,
  getReadySalesOrderItems,
  getProductionReadySalesOrders,
  getSalesOrderFullDetails,
  generatePlanCode,
  getItemBOMDetails
};
