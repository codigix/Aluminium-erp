const salesOrderService = require('../services/salesOrderService');

const listSalesOrders = async (req, res, next) => {
  try {
    const rows = await salesOrderService.listSalesOrders();
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

const getIncomingOrders = async (req, res, next) => {
  try {
    const departmentCode = req.user?.department_code || req.query.department;
    console.log(`[getIncomingOrders] User:`, req.user?.email, `| JWT department_code:`, req.user?.department_code, `| Query dept:`, req.query.department, `| Final departmentCode:`, departmentCode);
    
    if (!departmentCode) {
      console.error('[getIncomingOrders] ERROR: No department code provided');
      return res.status(400).json({ error: 'Department code is required' });
    }
    
    console.log(`[getIncomingOrders] Calling service with departmentCode: "${departmentCode}"`);
    const rows = await salesOrderService.getIncomingOrders(departmentCode);
    console.log(`[getIncomingOrders] Service returned ${rows.length} orders`);
    console.log(`[getIncomingOrders] Orders:`, rows.map(r => ({ id: r.id, status: r.status, current_department: r.current_department })));
    res.json(rows);
  } catch (error) {
    console.error('[getIncomingOrders] Exception:', error);
    next(error);
  }
};

const createSalesOrder = async (req, res, next) => {
  try {
    const { customerPoId, companyId, projectName, drawingRequired, productionPriority, targetDispatchDate, items } = req.body;
    const orderId = await salesOrderService.createSalesOrder(
      customerPoId,
      companyId,
      projectName,
      drawingRequired || 0,
      productionPriority || 'NORMAL',
      targetDispatchDate,
      items
    );
    res.status(201).json({ id: orderId, message: 'Sales order created' });
  } catch (error) {
    next(error);
  }
};

const updateSalesOrderStatus = async (req, res, next) => {
  try {
    await salesOrderService.updateSalesOrderStatus(req.params.id, req.body.status);
    res.json({ message: 'Sales order status updated' });
  } catch (error) {
    next(error);
  }
};

const acceptRequest = async (req, res, next) => {
  try {
    const departmentCode = req.user?.department_code || req.body.departmentCode;
    if (!departmentCode) {
      return res.status(400).json({ error: 'Department code is required' });
    }
    const result = await salesOrderService.acceptRequest(req.params.id, departmentCode);
    res.json({ message: 'Request accepted', ...result });
  } catch (error) {
    next(error);
  }
};

const rejectRequest = async (req, res, next) => {
  try {
    await salesOrderService.rejectRequest(req.params.id);
    res.json({ message: 'Request rejected and sent back to sales' });
  } catch (error) {
    next(error);
  }
};

const sendOrderToDesign = async (req, res, next) => {
  try {
    await salesOrderService.sendOrderToDesign(req.params.id);
    res.json({ message: 'Order sent to Design Engineering' });
  } catch (error) {
    next(error);
  }
};

const getOrderTimeline = async (req, res, next) => {
  try {
    const rows = await salesOrderService.getOrderTimeline(req.params.id);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

const generateSalesOrderPDF = async (req, res, next) => {
  try {
    const pdf = await salesOrderService.generateSalesOrderPDF(req.params.id);
    res.contentType('application/pdf');
    res.send(pdf);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listSalesOrders,
  getIncomingOrders,
  createSalesOrder,
  updateSalesOrderStatus,
  acceptRequest,
  rejectRequest,
  sendOrderToDesign,
  getOrderTimeline,
  generateSalesOrderPDF
};
