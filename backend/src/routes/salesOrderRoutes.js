const express = require('express');
const router = express.Router();
const salesOrderController = require('../controllers/salesOrderController');

const { authorize } = require('../middleware/authMiddleware');

router.get('/approved-drawings', authorize(['ORDER_VIEW']), salesOrderController.getApprovedDrawings);
router.get('/incoming', authorize(['ORDER_VIEW']), salesOrderController.getIncomingOrders);
router.get('/:id', authorize(['ORDER_VIEW']), salesOrderController.getSalesOrderById);
router.put('/:id', authorize(['ORDER_EDIT']), salesOrderController.updateSalesOrder);
router.get('/', authorize(['ORDER_VIEW']), salesOrderController.listSalesOrders);
router.post('/', authorize(['ORDER_CREATE']), salesOrderController.createSalesOrder);
router.post('/bulk/approve-designs', authorize(['STATUS_CHANGE']), salesOrderController.bulkApproveDesigns);
router.post('/bulk/reject-designs', authorize(['STATUS_CHANGE']), salesOrderController.bulkRejectDesigns);
router.post('/bulk/update-status', authorize(['STATUS_CHANGE']), salesOrderController.bulkUpdateStatus);
router.post('/bulk/items/status', authorize(['STATUS_CHANGE']), salesOrderController.bulkUpdateItemStatus);
router.patch('/:id/status', authorize(['STATUS_CHANGE']), salesOrderController.updateSalesOrderStatus);
router.post('/:id/send-to-design', authorize(['STATUS_CHANGE']), salesOrderController.sendOrderToDesign);
router.post('/:id/approve-design', authorize(['STATUS_CHANGE']), salesOrderController.approveDesign);
router.post('/:id/reject-design', authorize(['STATUS_CHANGE']), salesOrderController.rejectDesign);
router.post('/:id/accept', authorize(['STATUS_CHANGE']), salesOrderController.acceptRequest);
router.post('/:id/reject', authorize(['STATUS_CHANGE']), salesOrderController.rejectRequest);
router.get('/items/:itemId', authorize(['ORDER_VIEW']), salesOrderController.getSalesOrderItem);
router.patch('/items/:itemId', authorize(['ORDER_EDIT']), salesOrderController.updateSalesOrderItem);
router.patch('/items/:itemId/status', authorize(['STATUS_CHANGE']), salesOrderController.updateSalesOrderItemStatus);
router.get('/:id/items', authorize(['ORDER_VIEW']), salesOrderController.getOrderTimeline);
router.get('/:id/timeline', authorize(['ORDER_VIEW']), salesOrderController.getOrderTimeline);
router.get('/:id/pdf', authorize(['ORDER_VIEW']), salesOrderController.generateSalesOrderPDF);
router.delete('/:id', authorize(['ORDER_EDIT']), salesOrderController.deleteSalesOrder);

module.exports = router;
