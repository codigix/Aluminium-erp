const express = require('express');
const router = express.Router();
const designOrderController = require('../controllers/designOrderController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize(['DESIGN_VIEW', 'PROD_VIEW']), designOrderController.listDesignOrders);
router.get('/by-sales-order/:salesOrderId', authenticate, authorize(['DESIGN_VIEW', 'PROD_VIEW']), designOrderController.getDesignOrderItemsBySalesOrder);
router.patch('/:id/status', authenticate, authorize(['DESIGN_MANAGE']), designOrderController.updateStatus);
router.delete('/:id', authenticate, authorize(['DESIGN_MANAGE']), designOrderController.deleteOrder);

router.get('/bulk-requests', authenticate, authorize(['DESIGN_VIEW', 'PROD_VIEW']), designOrderController.listBulkRequests);
router.post('/bulk-requests/:id/approve', authenticate, authorize(['DESIGN_MANAGE']), designOrderController.approveBulkRequest);
router.post('/bulk-requests/:id/reject', authenticate, authorize(['DESIGN_MANAGE']), designOrderController.rejectBulkRequest);

module.exports = router;
