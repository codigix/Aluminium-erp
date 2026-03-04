const productionPlanService = require('../services/productionPlanService');

const listProductionPlans = async (req, res, next) => {
  try {
    const plans = await productionPlanService.listProductionPlans();
    res.json(plans);
  } catch (error) {
    next(error);
  }
};

const getProductionPlanById = async (req, res, next) => {
  try {
    const plan = await productionPlanService.getProductionPlanById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Production plan not found' });
    res.json(plan);
  } catch (error) {
    next(error);
  }
};

const createProductionPlan = async (req, res, next) => {
  try {
    const planId = await productionPlanService.createProductionPlan(req.body, req.user.id);
    res.status(201).json({ id: planId, message: 'Production plan created successfully' });
  } catch (error) {
    next(error);
  }
};

const updateProductionPlan = async (req, res, next) => {
  try {
    await productionPlanService.updateProductionPlan(req.params.id, req.body, req.user.id);
    res.json({ message: 'Production plan updated successfully' });
  } catch (error) {
    next(error);
  }
};

const getReadySalesOrderItems = async (req, res, next) => {
  try {
    const items = await productionPlanService.getReadySalesOrderItems();
    res.json(items);
  } catch (error) {
    next(error);
  }
};

const getProductionReadySalesOrders = async (req, res, next) => {
  try {
    const orders = await productionPlanService.getProductionReadySalesOrders();
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

const getSalesOrderFullDetails = async (req, res, next) => {
  try {
    const order = await productionPlanService.getSalesOrderFullDetails(req.params.id);
    if (!order) return res.status(404).json({ message: 'Sales order not found' });
    res.json(order);
  } catch (error) {
    next(error);
  }
};

const getNextPlanCode = async (req, res, next) => {
  try {
    const planCode = await productionPlanService.generatePlanCode();
    res.json({ planCode });
  } catch (error) {
    next(error);
  }
};

const getItemBOMDetails = async (req, res, next) => {
  try {
    const bomDetails = await productionPlanService.getItemBOMDetails(req.params.salesOrderItemId);
    if (!bomDetails) return res.status(404).json({ message: 'BOM details not found' });
    res.json(bomDetails);
  } catch (error) {
    next(error);
  }
};

const deleteProductionPlan = async (req, res, next) => {
  try {
    await productionPlanService.deleteProductionPlan(req.params.id);
    res.json({ message: 'Production plan deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const createMaterialRequestFromPlan = async (req, res, next) => {
  try {
    const result = await productionPlanService.createMaterialRequestFromPlan(req.params.id, req.user.id);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getMaterialRequestItemsForPlan = async (req, res, next) => {
  try {
    const items = await productionPlanService.getMaterialRequestItemsForPlan(req.params.id);
    res.json(items);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listProductionPlans,
  getProductionPlanById,
  createProductionPlan,
  updateProductionPlan,
  getReadySalesOrderItems,
  getProductionReadySalesOrders,
  getSalesOrderFullDetails,
  getNextPlanCode,
  getItemBOMDetails,
  deleteProductionPlan,
  createMaterialRequestFromPlan,
  getMaterialRequestItemsForPlan
};
