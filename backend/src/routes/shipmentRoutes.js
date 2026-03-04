const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const returnController = require('../controllers/returnController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/orders', authenticate, authorize(['ORDER_VIEW']), shipmentController.getShipmentOrders);
router.get('/dashboard', authenticate, authorize(['ORDER_VIEW']), shipmentController.getShipmentDashboard);
router.get('/reports', authenticate, authorize(['ORDER_VIEW']), shipmentController.getShipmentReports);
router.post('/orders', authenticate, authorize(['ORDER_CREATE']), shipmentController.createShipmentOrder);
router.get('/orders/:id', authenticate, authorize(['ORDER_VIEW']), shipmentController.getShipmentOrderById);
router.patch('/orders/:id/status', authenticate, authorize(['STATUS_CHANGE']), shipmentController.updateShipmentStatus);
router.patch('/orders/:id/planning', authenticate, authorize(['STATUS_CHANGE']), shipmentController.updateShipmentPlanning);
router.delete('/orders/:id', authenticate, authorize(['ORDER_EDIT', 'STATUS_CHANGE']), shipmentController.deleteShipmentOrder);

// Return Routes
router.get('/returns', authenticate, authorize(['ORDER_VIEW']), returnController.getReturns);
router.get('/returns/stats', authenticate, authorize(['ORDER_VIEW']), returnController.getReturnStats);
router.get('/returns/:id', authenticate, authorize(['ORDER_VIEW']), returnController.getReturnById);
router.post('/returns', authenticate, authorize(['STATUS_CHANGE']), returnController.initiateReturn);
router.patch('/returns/:id/status', authenticate, authorize(['STATUS_CHANGE']), returnController.updateReturnStatus);

// Tracking Routes
router.get('/tracking/dashboard', authenticate, authorize(['ORDER_VIEW']), shipmentController.getTrackingDashboard);
router.get('/orders/:id/tracking', authenticate, authorize(['ORDER_VIEW']), shipmentController.getTrackingHistory);
router.post('/orders/:id/tracking', authenticate, authorize(['ORDER_EDIT']), shipmentController.updateTracking);

module.exports = router;
