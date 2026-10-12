const express = require('express');
const router = express.Router();
const salesInvoiceController = require('../controllers/salesInvoiceController');
const { authorize } = require('../middleware/authMiddleware');

router.get('/available-orders', authorize(['ORDER_VIEW', 'PAYMENT_VIEW']), salesInvoiceController.getAvailableSalesOrders);
router.get('/order-details/:orderId', authorize(['ORDER_VIEW', 'PAYMENT_VIEW']), salesInvoiceController.getOrderDetailsForInvoice);
router.get('/next-number', authorize(['ORDER_VIEW', 'PAYMENT_VIEW']), salesInvoiceController.getNextInvoiceNo);
router.get('/', authorize(['ORDER_VIEW', 'PAYMENT_VIEW']), salesInvoiceController.listSalesInvoices);
router.post('/', authorize(['ORDER_CREATE', 'ORDER_EDIT', 'PAYMENT_PROCESS']), salesInvoiceController.createSalesInvoice);
router.get('/:id/pdf', authorize(['ORDER_VIEW', 'PAYMENT_VIEW']), salesInvoiceController.generateSalesInvoicePDF);
router.get('/:id', authorize(['ORDER_VIEW', 'PAYMENT_VIEW']), salesInvoiceController.getSalesInvoiceById);
router.delete('/:id', authorize(['ORDER_EDIT', 'PAYMENT_EDIT']), salesInvoiceController.deleteSalesInvoice);

module.exports = router;
