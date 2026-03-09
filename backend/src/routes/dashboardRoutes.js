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

module.exports = router;
