const pool = require('../config/db');

const listSalesOrders = async () => {
  const [rows] = await pool.query(
    `SELECT so.*, c.company_name, cp.po_number, cp.po_date, cp.currency AS po_currency, cp.net_total AS po_net_total, cp.pdf_path
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     ORDER BY so.created_at DESC`
  );
  return rows;
};

const getIncomingOrders = async (departmentCode) => {
  console.log(`[getIncomingOrders-service] Starting query for department: "${departmentCode}"`);
  
  let whereClause = '';
  if (departmentCode === 'DESIGN_ENG') {
    whereClause = `so.status IN ('CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_QUERY')`;
  } else if (departmentCode === 'PROCUREMENT') {
    whereClause = `so.status IN ('DESIGN_APPROVED', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS')`;
  } else if (departmentCode === 'INVENTORY') {
    whereClause = `so.status IN ('CREATED', 'DESIGN_APPROVED', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION')`;
  } else if (departmentCode === 'PRODUCTION') {
    whereClause = `so.status IN ('MATERIAL_READY', 'IN_PRODUCTION')`;
  } else {
    whereClause = `so.current_department = '${departmentCode}'`;
  }
  
  const query = `SELECT so.*, c.company_name, c.company_code, cp.po_number, cp.po_date, cp.currency AS po_currency, cp.net_total AS po_net_total, cp.pdf_path, 
            d.name as current_dept_name
     FROM sales_orders so
     LEFT JOIN companies c ON c.id = so.company_id
     LEFT JOIN customer_pos cp ON cp.id = so.customer_po_id
     LEFT JOIN departments d ON d.code = so.current_department
     WHERE ${whereClause}
     ORDER BY so.created_at DESC`;
  
  const [rows] = await pool.query(query);
  console.log(`[getIncomingOrders-service] Query returned ${rows.length} rows for department "${departmentCode}"`);
  console.log(`[getIncomingOrders-service] Raw rows:`, rows);
  return rows;
};

const createSalesOrder = async (customerPoId, companyId, projectName, drawingRequired, productionPriority, targetDispatchDate) => {
  const [result] = await pool.execute(
    `INSERT INTO sales_orders (customer_po_id, company_id, project_name, drawing_required, production_priority, target_dispatch_date, status, current_department, request_accepted)
     VALUES (?, ?, ?, ?, ?, ?, 'CREATED', 'DESIGN_ENG', 0)`,
    [customerPoId, companyId, projectName, drawingRequired, productionPriority, targetDispatchDate]
  );
  return result.insertId;
};

const updateSalesOrderStatus = async (salesOrderId, status) => {
  await pool.execute('UPDATE sales_orders SET status = ? WHERE id = ?', [status, salesOrderId]);
};

const acceptRequest = async (salesOrderId, departmentCode) => {
  const [order] = await pool.query('SELECT * FROM sales_orders WHERE id = ?', [salesOrderId]);
  if (!order.length) throw new Error('Order not found');

  const currentOrder = order[0];
  let newStatus = currentOrder.status;
  let nextDepartment = currentOrder.current_department;

  if (departmentCode === 'DESIGN_ENG' && (currentOrder.status === 'CREATED' || currentOrder.status === 'DESIGN_IN_REVIEW')) {
    newStatus = 'DESIGN_APPROVED';
    nextDepartment = 'PROCUREMENT';
  } else if (departmentCode === 'PROCUREMENT' && (currentOrder.status === 'DESIGN_APPROVED' || currentOrder.status === 'PROCUREMENT_IN_PROGRESS')) {
    if (currentOrder.material_available) {
      newStatus = 'MATERIAL_READY';
      nextDepartment = 'PRODUCTION';
    } else {
      newStatus = 'MATERIAL_PURCHASE_IN_PROGRESS';
      nextDepartment = 'PROCUREMENT';
    }
  } else if (departmentCode === 'PRODUCTION' && (currentOrder.status === 'MATERIAL_READY' || currentOrder.status === 'IN_PRODUCTION')) {
    newStatus = 'PRODUCTION_COMPLETED';
    nextDepartment = 'QC';
  }

  await pool.execute(
    'UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 1, updated_at = NOW() WHERE id = ?',
    [newStatus, nextDepartment, salesOrderId]
  );

  return { status: newStatus, currentDepartment: nextDepartment };
};

const rejectRequest = async (salesOrderId) => {
  await pool.execute(
    'UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 0, updated_at = NOW() WHERE id = ?',
    ['DESIGN_QUERY', 'SALES', salesOrderId]
  );
};

const transitionToDepartment = async (salesOrderId, toDepartment, newStatus) => {
  await pool.execute(
    'UPDATE sales_orders SET status = ?, current_department = ?, updated_at = NOW() WHERE id = ?',
    [newStatus, toDepartment, salesOrderId]
  );
};

const sendOrderToDesign = async (salesOrderId) => {
  await pool.execute(
    'UPDATE sales_orders SET status = ?, current_department = ?, request_accepted = 0, updated_at = NOW() WHERE id = ?',
    ['DESIGN_IN_REVIEW', 'DESIGN_ENG', salesOrderId]
  );
};

const getOrderTimeline = async salesOrderId => {
  const [items] = await pool.query(
    'SELECT * FROM sales_order_items WHERE sales_order_id = ?',
    [salesOrderId]
  );
  return items;
};

module.exports = {
  listSalesOrders,
  getIncomingOrders,
  createSalesOrder,
  updateSalesOrderStatus,
  acceptRequest,
  rejectRequest,
  transitionToDepartment,
  sendOrderToDesign,
  getOrderTimeline
};
