const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

const { authorize } = require('../middleware/authMiddleware');

router.get('/', authorize(['DASHBOARD_VIEW']), dashboardController.getDashboard);
router.get('/accounts', authorize(['DASHBOARD_VIEW']), dashboardController.getAccountsDashboard);
router.get('/procurement', authorize(['DASHBOARD_VIEW']), dashboardController.getProcurementDashboard);
router.get('/production', authorize(['DASHBOARD_VIEW']), dashboardController.getProductionDashboard);
router.get('/design', authorize(['DASHBOARD_VIEW']), dashboardController.getDesignDashboard);
router.get('/sales', authorize(['DASHBOARD_VIEW']), dashboardController.getSalesDashboard);
router.get('/shipment', authorize(['DASHBOARD_VIEW']), dashboardController.getShipmentDashboard);
router.get('/procurement-report', authorize(['DASHBOARD_VIEW']), dashboardController.getProcurementReport);
router.get('/production-report', authorize(['DASHBOARD_VIEW']), dashboardController.getProductionReport);
router.get('/inventory-report', authorize(['DASHBOARD_VIEW']), dashboardController.getInventoryReport);
router.get('/accounts-report', authorize(['DASHBOARD_VIEW']), dashboardController.getAccountsReport);

module.exports = router;
