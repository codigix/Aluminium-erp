const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authorize } = require('../middleware/authMiddleware');

router.get('/', authorize(['ORDER_VIEW']), orderController.listOrders);
router.get('/approved-drawings', authorize(['ORDER_VIEW']), orderController.getApprovedDrawings);
router.post('/', authorize(['ORDER_CREATE']), orderController.createOrder);
router.get('/:id', authorize(['ORDER_VIEW']), orderController.getOrderById);
router.put('/:id', authorize(['ORDER_EDIT']), orderController.updateOrder);
router.delete('/:id', authorize(['ORDER_EDIT']), orderController.deleteOrder);
router.get('/:id/pdf', authorize(['ORDER_VIEW']), orderController.generateOrderPDF);

module.exports = router;
