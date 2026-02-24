const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authorize } = require('../middleware/authMiddleware');

router.post('/', authorize(['PAYMENT_PROCESS']), paymentController.processPayment);
router.get('/', authorize(['PAYMENT_VIEW']), paymentController.getPayments);
router.get('/pending', authorize(['PAYMENT_VIEW']), paymentController.getPendingPayments);
router.get('/:paymentId', authorize(['PAYMENT_VIEW']), paymentController.getPaymentById);
router.get('/:paymentId/pdf', authorize(['PAYMENT_VIEW']), paymentController.getPaymentVoucherPDF);
router.post('/:paymentId/send-email', authorize(['PAYMENT_PROCESS']), paymentController.sendPaymentVoucherEmail);
router.patch('/:paymentId/status', authorize(['PAYMENT_EDIT']), paymentController.updatePaymentStatus);
router.delete('/:paymentId', authorize(['PAYMENT_EDIT']), paymentController.deletePayment);

module.exports = router;
