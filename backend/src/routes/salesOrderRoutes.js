const express = require('express');
const router = express.Router();
const salesOrderController = require('../controllers/salesOrderController');

router.get('/incoming', salesOrderController.getIncomingOrders);
router.get('/', salesOrderController.listSalesOrders);
router.post('/', salesOrderController.createSalesOrder);
router.patch('/:id/status', salesOrderController.updateSalesOrderStatus);
router.post('/:id/send-to-design', salesOrderController.sendOrderToDesign);
router.post('/:id/accept', salesOrderController.acceptRequest);
router.post('/:id/reject', salesOrderController.rejectRequest);
router.get('/:id/timeline', salesOrderController.getOrderTimeline);
router.get('/:id/pdf', salesOrderController.generateSalesOrderPDF);

// Material Management for Items
router.get('/items/:itemId/materials', salesOrderController.getItemMaterials);
router.post('/items/:itemId/materials', salesOrderController.addItemMaterial);
router.delete('/materials/:id', salesOrderController.deleteItemMaterial);

module.exports = router;
