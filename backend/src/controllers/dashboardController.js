const dashboardService = require('../services/dashboardService');

const getDashboard = async (req, res, next) => {
  try {
    const stats = await dashboardService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

const getAccountsDashboard = async (req, res, next) => {
  try {
    const stats = await dashboardService.getAccountsDashboardStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

const getProcurementDashboard = async (req, res, next) => {
  try {
    const stats = await dashboardService.getProcurementDashboardStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

const getProductionDashboard = async (req, res, next) => {
  try {
    const stats = await dashboardService.getProductionDashboardStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

const getDesignDashboard = async (req, res, next) => {
  try {
    const stats = await dashboardService.getDesignDashboardStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

const getSalesDashboard = async (req, res, next) => {
  try {
    const stats = await dashboardService.getSalesDashboardStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  getDashboard, 
  getAccountsDashboard,
  getProcurementDashboard,
  getProductionDashboard,
  getDesignDashboard,
  getSalesDashboard
};
