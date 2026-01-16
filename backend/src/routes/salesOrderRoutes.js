const express = require('express');
const router = express.Router();
const salesOrderController = require('../controllers/salesOrderController');

router.get('/approved-drawings', salesOrderController.getApprovedDrawings);
router.get('/incoming', salesOrderController.getIncomingOrders);
router.get('/', salesOrderController.listSalesOrders);
router.post('/', salesOrderController.createSalesOrder);
router.post('/bulk/approve-designs', salesOrderController.bulkApproveDesigns);
router.post('/bulk/reject-designs', salesOrderController.bulkRejectDesigns);
router.post('/bulk/update-status', salesOrderController.bulkUpdateStatus);
router.patch('/:id/status', salesOrderController.updateSalesOrderStatus);
router.post('/:id/send-to-design', salesOrderController.sendOrderToDesign);
router.post('/:id/approve-design', salesOrderController.approveDesign);
router.post('/:id/reject-design', salesOrderController.rejectDesign);
router.post('/:id/accept', salesOrderController.acceptRequest);
router.post('/:id/reject', salesOrderController.rejectRequest);
router.get('/items/:itemId', salesOrderController.getSalesOrderItem);
router.get('/:id/items', salesOrderController.getOrderTimeline);
router.get('/:id/timeline', salesOrderController.getOrderTimeline);
router.get('/:id/pdf', salesOrderController.generateSalesOrderPDF);
router.delete('/:id', salesOrderController.deleteSalesOrder);

module.exports = router;
