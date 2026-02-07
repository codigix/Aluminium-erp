const inventoryDashboardService = require('../services/inventoryDashboardService');

const getIncomingOrders = async (req, res, next) => {
  try {
    const orders = await inventoryDashboardService.getIncomingOrders();
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

const getPendingGRNs = async (req, res, next) => {
  try {
    const grns = await inventoryDashboardService.getPendingGRNs();
    res.json(grns);
  } catch (error) {
    next(error);
  }
};

const getLowStockItems = async (req, res, next) => {
  try {
    const items = await inventoryDashboardService.getLowStockItems();
    res.json(items);
  } catch (error) {
    next(error);
  }
};

const getQCPendingItems = async (req, res, next) => {
  try {
    const items = await inventoryDashboardService.getQCPendingItems();
    res.json(items);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getIncomingOrders,
  getPendingGRNs,
  getLowStockItems,
  getQCPendingItems
};
