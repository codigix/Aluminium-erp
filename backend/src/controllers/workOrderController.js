const workOrderService = require('../services/workOrderService');
const { respondWithError } = require('../config/productionWorkflow');

const listWorkOrders = async (req, res) => {
  try {
    const workOrders = await workOrderService.listWorkOrders();
    res.json(workOrders);
  } catch (error) {
    respondWithError(res, error);
  }
};

const getWorkOrderById = async (req, res) => {
  try {
    const workOrder = await workOrderService.getWorkOrderById(req.params.id);
    if (!workOrder) {
      return res.status(404).json({ error: 'Work Order not found' });
    }
    res.json(workOrder);
  } catch (error) {
    respondWithError(res, error);
  }
};

const createWorkOrder = async (req, res) => {
  try {
    const id = await workOrderService.createWorkOrder(req.body);
    const newWO = await workOrderService.getWorkOrderById(id);
    res.status(201).json(newWO);
  } catch (error) {
    respondWithError(res, error);
  }
};

const updateWorkOrder = async (req, res) => {
  try {
    await workOrderService.updateWorkOrder(req.params.id, req.body, req.user?.id || null);
    res.json(await workOrderService.getWorkOrderById(req.params.id));
  } catch (error) {
    respondWithError(res, error);
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    await workOrderService.updateWorkOrderStatus(req.params.id, status, req.user?.id || null, reason || null);
    res.json({ success: true });
  } catch (error) {
    respondWithError(res, error);
  }
};

const getNextWoNumber = async (req, res) => {
  try {
    const woNumber = await workOrderService.generateWoNumber();
    res.json({ woNumber });
  } catch (error) {
    respondWithError(res, error);
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
    respondWithError(res, error);
  }
};

const deleteWorkOrder = async (req, res) => {
  try {
    await workOrderService.deleteWorkOrder(req.params.id, req.user?.id || null);
    res.json({ success: true, message: 'Work Order deleted successfully' });
  } catch (error) {
    respondWithError(res, error);
  }
};

const deleteAllWorkOrders = async (req, res) => {
  try {
    const result = await workOrderService.deleteAllWorkOrders(req.user?.id || null);
    res.json({ message: 'All Work Orders deleted successfully', ...result });
  } catch (error) {
    respondWithError(res, error);
  }
};

const getMaterialRequirements = async (req, res) => {
  try {
    const requirements = await workOrderService.getWorkOrderMaterialRequirements(req.params.id);
    res.json(requirements);
  } catch (error) {
    respondWithError(res, error);
  }
};

const updateMaterialConsumption = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await workOrderService.updateMaterialConsumption(req.params.id, req.body, userId);
    res.json(result);
  } catch (error) {
    respondWithError(res, error);
  }
};

const returnMaterial = async (req, res) => {
  try {
    const result = await workOrderService.returnMaterial(req.params.id, req.body, req.user?.id || null);
    res.status(201).json(result);
  } catch (error) {
    respondWithError(res, error);
  }
};

const getMaterialReconciliation = async (req, res) => {
  try {
    res.json(await workOrderService.getMaterialReconciliation(req.params.id));
  } catch (error) {
    respondWithError(res, error);
  }
};

module.exports = {
  updateWorkOrder,
  returnMaterial,
  getMaterialReconciliation,
  listWorkOrders,
  getWorkOrderById,
  createWorkOrder,
  createWorkOrdersFromPlan,
  updateStatus,
  getNextWoNumber,
  deleteWorkOrder,
  deleteAllWorkOrders,
  getMaterialRequirements,
  updateMaterialConsumption
};
