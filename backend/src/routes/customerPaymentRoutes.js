const express = require('express');
const router = express.Router();
const customerPaymentController = require('../controllers/customerPaymentController');
const { authorize } = require('../middleware/authMiddleware');

router.post('/', authorize(['PAYMENT_PROCESS']), customerPaymentController.recordPaymentReceived);
router.get('/', authorize(['PAYMENT_VIEW']), customerPaymentController.getPaymentsReceived);
router.get('/outstanding', authorize(['PAYMENT_VIEW']), customerPaymentController.getAllOutstandingInvoices);
router.get('/:paymentId', authorize(['PAYMENT_VIEW']), customerPaymentController.getPaymentReceivedById);
router.get('/customer/:customerId/balance', authorize(['PAYMENT_VIEW']), customerPaymentController.getCustomerBalance);
router.get('/customer/:customerId/outstanding', authorize(['PAYMENT_VIEW']), customerPaymentController.getOutstandingInvoices);
router.patch('/:paymentId/status', authorize(['PAYMENT_EDIT']), customerPaymentController.updatePaymentStatus);
router.delete('/:paymentId', authorize(['PAYMENT_EDIT']), customerPaymentController.deletePayment);

module.exports = router;
