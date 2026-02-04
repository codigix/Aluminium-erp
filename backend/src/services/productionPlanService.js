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
  // We join with customer_po_items to get the original Design Quantity if available
  const [rows] = await pool.query(
    `SELECT so.id as sales_order_id, 
            o.order_no as order_no, 
            so.project_name, 
            so.production_priority, 
            so.created_at,
            soi.id as sales_order_item_id, 
            soi.item_code as item_code, 
            soi.item_type as item_type,
            soi.drawing_no as drawing_no,
            soi.description as description, 
            COALESCE(poi.quantity, cd.qty, soi.quantity) as total_qty, 
            soi.unit as unit,
            COALESCE(planned.already_planned_qty, 0) as already_planned_qty
     FROM (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY sales_order_id, drawing_no ORDER BY id DESC) as rn
       FROM sales_order_items
       WHERE status != 'Rejected' AND (item_type IN ('FG', 'SFG'))
     ) soi
     JOIN sales_orders so ON soi.sales_order_id = so.id
     LEFT JOIN customer_po_items poi ON so.customer_po_id = poi.customer_po_id AND soi.drawing_no = poi.drawing_no
     LEFT JOIN customer_drawings cd ON soi.drawing_id = cd.id
     JOIN (
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
       AND (COALESCE(planned.already_planned_qty, 0) < COALESCE(poi.quantity, cd.qty, soi.quantity))
     ORDER BY so.production_priority DESC, so.created_at ASC`
  );
  return rows;
};

const getProductionReadySalesOrders = async () => {
  const [rows] = await pool.query(
    `SELECT so.id, 
            o.order_no, 
            so.project_name, 
            cp.po_number, 
            c.company_name, 
            so.created_at
     FROM sales_orders so
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
     JOIN orders o ON o.quotation_id = so.id
     WHERE EXISTS (
       SELECT 1 FROM (
         SELECT sales_order_id, drawing_no, ROW_NUMBER() OVER (PARTITION BY sales_order_id, drawing_no ORDER BY id DESC) as rn
         FROM sales_order_items
         WHERE status != 'Rejected' AND (item_type IN ('FG', 'SFG'))
       ) soi 
       WHERE soi.sales_order_id = so.id AND soi.rn = 1
     )
     GROUP BY so.id, so.project_name, cp.po_number, c.company_name, so.created_at, o.order_no
     ORDER BY so.created_at DESC`
  );
  return rows;
};

const getSalesOrderFullDetails = async (id) => {
  const [orders] = await pool.query(
    `SELECT so.*, c.company_name, cp.po_number, o.order_no
     FROM sales_orders so
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
     JOIN (
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
            COALESCE(poi.quantity, cd.qty, soi.quantity) as quantity,
            soi.unit,
            soi.status,
            soi.rejection_reason,
            COALESCE(planned.already_planned_qty, 0) as already_planned_qty
     FROM (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY sales_order_id, drawing_no ORDER BY id DESC) as rn
       FROM sales_order_items
       WHERE sales_order_id = ? AND (item_type IN ('FG', 'SFG'))
     ) soi
     LEFT JOIN sales_orders so ON so.id = soi.sales_order_id
     LEFT JOIN customer_po_items poi ON so.customer_po_id = poi.customer_po_id AND soi.drawing_no = poi.drawing_no
     LEFT JOIN customer_drawings cd ON soi.drawing_id = cd.id
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
  // Fetch the item details first - expand item_type to include SA/SFG/FG
  const [items] = await pool.query(
    'SELECT id, item_code, drawing_no FROM sales_order_items WHERE id = ? AND item_type IN ("FG", "SFG", "SA")',
    [salesOrderItemId]
  );

  if (items.length === 0) return null;
  const item = items[0];

  // Helper function to recursively fetch BOM details
  const fetchRecursiveBOM = async (itemCode, drawingNo, soItemId = null, parentId = null) => {
    let materials = [];
    let components = [];
    let operations = [];

    // 1. Try to fetch SO-specific data if soItemId is provided
    if (soItemId) {
      const [soMaterials] = await pool.query(
        'SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = ? AND parent_id <=> ?',
        [soItemId, parentId]
      );
      const [soComponents] = await pool.query(
        'SELECT * FROM sales_order_item_components WHERE sales_order_item_id = ? AND parent_id <=> ?',
        [soItemId, parentId]
      );
      
      materials = soMaterials;
      components = soComponents;

      // Operations are usually top-level
      if (parentId === null) {
        const [soOperations] = await pool.query(
          'SELECT * FROM sales_order_item_operations WHERE sales_order_item_id = ?',
          [soItemId]
        );
        operations = soOperations;
      }
    }

    // 2. Fallback to Master BOM for missing parts
    // We check materials and components independently to avoid one blocking the other's fallback
    if (materials.length === 0 || components.length === 0 || (parentId === null && operations.length === 0)) {
      const masterMaterials = await bomService.getItemMaterials(null, itemCode, drawingNo);
      const masterComponents = await bomService.getItemComponents(null, itemCode, drawingNo);
      
      // If we are at the top level of a standalone item BOM call, parent_id must be null
      // If we are recursing within a Master BOM identity, we use parentId
      const targetParentId = soItemId ? (parentId || null) : (parentId || null);

      if (materials.length === 0) {
        materials = masterMaterials.filter(m => m.parent_id === targetParentId);
      }
      if (components.length === 0) {
        components = masterComponents.filter(c => c.parent_id === targetParentId);
      }
      if (operations.length === 0) {
        operations = await bomService.getItemOperations(null, itemCode, drawingNo);
      }
    }

    // 3. Recursively resolve components
    const resolvedComponents = await Promise.all(components.map(async (comp) => {
      // Logic for determining if this component should be exploded
      const isSubAssembly = comp.component_code && (
        comp.component_code.startsWith('FG-') || 
        comp.component_code.startsWith('SA-') || 
        comp.component_code.startsWith('SFG-') || 
        comp.component_code.startsWith('RM-PANEL') ||
        comp.drawing_no
      );

      if (isSubAssembly) {
        // If this component came from a Master BOM (no sales_order_item_id),
        // we must stay in Master BOM context for its children or reset context for its own BOM
        const nextSoItemId = comp.sales_order_item_id ? soItemId : null;
        
        // We pass comp.id if we want children of this record in the same BOM
        // BUT if it's a standalone assembly, its materials are usually at its own top level (parent_id null)
        // Our fetchRecursiveBOM fallback handles this by checking masterMaterials for itemCode
        const subDetails = await fetchRecursiveBOM(comp.component_code, comp.drawing_no, nextSoItemId, comp.id);
        
        return {
          ...comp,
          materials: subDetails.materials,
          components: subDetails.components,
          operations: subDetails.operations
        };
      }
      return {
        ...comp,
        materials: [],
        components: [],
        operations: []
      };
    }));

    return { materials, components: resolvedComponents, operations };
  };

  return fetchRecursiveBOM(item.item_code, item.drawing_no, salesOrderItemId, null);
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
