const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/orders', authenticate, authorize(['ORDER_VIEW']), shipmentController.getShipmentOrders);
router.get('/orders/:id', authenticate, authorize(['ORDER_VIEW']), shipmentController.getShipmentOrderById);
router.patch('/orders/:id/status', authenticate, authorize(['STATUS_CHANGE']), shipmentController.updateShipmentStatus);

module.exports = router;
