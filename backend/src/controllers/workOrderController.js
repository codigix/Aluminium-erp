const workOrderService = require('../services/workOrderService');

const listWorkOrders = async (req, res) => {
  try {
    const workOrders = await workOrderService.listWorkOrders();
    res.json(workOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createWorkOrder = async (req, res) => {
  try {
    const id = await workOrderService.createWorkOrder(req.body);
    const newWO = await workOrderService.getWorkOrderById(id);
    res.status(201).json(newWO);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    await workOrderService.updateWorkOrderStatus(req.params.id, status);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getNextWoNumber = async (req, res) => {
  try {
    const woNumber = await workOrderService.generateWoNumber();
    res.json({ woNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createWorkOrdersFromPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const workOrderIds = await workOrderService.createWorkOrdersFromPlan(planId);
    res.status(201).json({ 
      message: `${workOrderIds.length} work orders created successfully`,
      workOrderIds 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteWorkOrder = async (req, res) => {
  try {
    await workOrderService.deleteWorkOrder(req.params.id);
    res.json({ success: true, message: 'Work Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listWorkOrders,
  createWorkOrder,
  createWorkOrdersFromPlan,
  updateStatus,
  getNextWoNumber,
  deleteWorkOrder
};
