const express = require('express');
const router = express.Router();
const designOrderController = require('../controllers/designOrderController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize(['DESIGN_VIEW']), designOrderController.listDesignOrders);
router.get('/by-sales-order/:salesOrderId', authenticate, authorize(['DESIGN_VIEW']), designOrderController.getDesignOrderItemsBySalesOrder);
router.patch('/:id/status', authenticate, authorize(['DESIGN_MANAGE']), designOrderController.updateStatus);
router.delete('/:id', authenticate, authorize(['DESIGN_MANAGE']), designOrderController.deleteOrder);

module.exports = router;
