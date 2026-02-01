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
  // We can filter by status like 'MATERIAL_READY', 'DESIGN_APPROVED', 'CREATED' (if no drawing required)
  const [rows] = await pool.query(
    `SELECT so.id as sales_order_id, so.project_name, so.production_priority, so.created_at,
            soi.id as sales_order_item_id, soi.item_code, soi.description, soi.quantity as total_qty, soi.unit,
            COALESCE(soi.material_name, sb.material_name) as material_name,
            COALESCE(soi.item_group, sb.item_group) as item_group, 
            COALESCE(soi.material_type, sb.material_type) as material_type, 
            COALESCE(soi.product_type, sb.product_type) as product_type,
            COALESCE(SUM(ppi.planned_qty), 0) as already_planned_qty
     FROM sales_orders so
     JOIN sales_order_items soi ON so.id = soi.sales_order_id
     LEFT JOIN stock_balance sb ON soi.item_code = sb.item_code
     LEFT JOIN production_plan_items ppi ON soi.id = ppi.sales_order_item_id AND ppi.status != 'CANCELLED'
     WHERE so.status IN ('MATERIAL_READY', 'DESIGN_APPROVED', 'CREATED', 'DESIGN_IN_REVIEW', 'BOM_APPROVED')
     AND soi.status != 'Rejected'
     GROUP BY soi.id
     HAVING already_planned_qty < total_qty
     ORDER BY so.production_priority DESC, so.created_at ASC`
  );
  return rows;
};

const getProductionReadySalesOrders = async () => {
  const [rows] = await pool.query(
    `SELECT DISTINCT so.id, so.project_name, cp.po_number, c.company_name, so.created_at
     FROM sales_orders so
     JOIN sales_order_items soi ON so.id = soi.sales_order_id
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
     WHERE so.status IN ('MATERIAL_READY', 'DESIGN_APPROVED', 'CREATED', 'DESIGN_IN_REVIEW', 'BOM_APPROVED')
     AND soi.status != 'Rejected'
     ORDER BY so.created_at DESC`
  );
  return rows;
};

const getSalesOrderFullDetails = async (id) => {
  const [orders] = await pool.query(
    `SELECT so.*, c.company_name, cp.po_number
     FROM sales_orders so
     LEFT JOIN companies c ON so.company_id = c.id
     LEFT JOIN customer_pos cp ON so.customer_po_id = cp.id
     WHERE so.id = ?`,
    [id]
  );

  if (orders.length === 0) return null;
  const order = orders[0];

  const [items] = await pool.query(
    `SELECT soi.*, 
            COALESCE(SUM(ppi.planned_qty), 0) as already_planned_qty
     FROM sales_order_items soi
     LEFT JOIN production_plan_items ppi ON soi.id = ppi.sales_order_item_id AND ppi.status != 'CANCELLED'
     WHERE soi.sales_order_id = ?
     GROUP BY soi.id`,
    [id]
  );

  for (let item of items) {
    // 1. Get all materials (recursive explosion) and direct components
    const allMaterials = await bomService.explodeBOM(item.id, item.item_code, item.drawing_no, 1);
    const directComponents = await bomService.getItemComponents(item.id, item.item_code, item.drawing_no);

    // 2. Get operations and scrap with proper fallback
    item.operations = await bomService.getItemOperations(item.id, item.item_code, item.drawing_no);
    item.scrap = await bomService.getItemScrap(item.id, item.item_code, item.drawing_no);

    // 3. Separate exploded materials into Raw Materials and Sub-Assemblies/FG
    // Sub-assemblies should be identified by item_group or material_type
    const subAssemblies = allMaterials.filter(m => {
      const group = (m.item_group || '').toLowerCase().trim();
      const type = (m.material_type || '').toLowerCase().trim();
      const prodType = (m.product_type || '').toLowerCase().trim();
      const code = (m.component_code || m.material_name || '').toLowerCase().trim();

      const isSA = group.includes('assembly') || group === 'sa' || group.includes('semi-finished') || group.includes('wip') ||
                   type.includes('assembly') || type === 'sa' || type.includes('semi-finished') || type.includes('wip') ||
                   prodType.includes('assembly') || prodType === 'sa' || prodType.includes('semi-finished') || prodType.includes('wip') ||
                   code.startsWith('sa-') || code.startsWith('wip-') || code.startsWith('sfg-');

      const isFG = group === 'fg' || prodType === 'fg' || group.includes('finished') || prodType.includes('finished') || type.includes('finished') ||
                   code.startsWith('fg-');

      return isSA || isFG;
    });

    // item.materials should only contain leaf-level raw materials
    item.materials = allMaterials.filter(m => !subAssemblies.some(sa => sa === m));

    // 4. Combine direct components and all exploded sub-assemblies for the production plan view
    // Group them by component_code + uom to sum quantities but keep different items separate
    const componentMap = new Map();

    // First add direct components
    directComponents.forEach(c => {
      const code = (c.component_code || c.componentCode || c.material_name || 'UNKNOWN').toUpperCase().trim();
      const uom = (c.uom || 'Nos').toUpperCase().trim();
      const key = `${code}|${uom}`;
      
      componentMap.set(key, {
        ...c,
        component_code: c.component_code || c.componentCode || c.material_name,
        quantity: parseFloat(c.quantity || 0)
      });
    });

    // Then merge exploded sub-assemblies
    subAssemblies.forEach(sa => {
      const code = (sa.component_code || sa.material_name || 'UNKNOWN').toUpperCase().trim();
      const uom = (sa.uom || 'Nos').toUpperCase().trim();
      const key = `${code}|${uom}`;

      if (componentMap.has(key)) {
        const existing = componentMap.get(key);
        // If it's from explosion, we add to the quantity
        existing.quantity += parseFloat(sa.qty_per_pc || 0);
      } else {
        componentMap.set(key, {
          ...sa,
          component_code: sa.component_code || sa.material_name,
          quantity: parseFloat(sa.qty_per_pc || 0)
        });
      }
    });

    item.components = Array.from(componentMap.values());

    // Final check for BOM existence
    item.has_bom = Boolean(item.materials?.length > 0 || item.components?.length > 0 || item.operations?.length > 0);
  }

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

module.exports = {
  listProductionPlans,
  getProductionPlanById,
  createProductionPlan,
  getReadySalesOrderItems,
  getProductionReadySalesOrders,
  getSalesOrderFullDetails,
  generatePlanCode
};
