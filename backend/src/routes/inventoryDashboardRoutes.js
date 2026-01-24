const express = require('express');
const router = express.Router();
const inventoryDashboardController = require('../controllers/inventoryDashboardController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);
router.use(authorize(['STOCK_VIEW', 'GRN_VIEW']));

router.get('/incoming-orders', inventoryDashboardController.getIncomingOrders);
router.get('/pending-grns', inventoryDashboardController.getPendingGRNs);
router.get('/low-stock', inventoryDashboardController.getLowStockItems);
router.get('/qc-pending', inventoryDashboardController.getQCPendingItems);

module.exports = router;
