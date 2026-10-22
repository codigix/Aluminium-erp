const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authorize } = require('../middleware/authMiddleware');

router.post('/', authorize(['PAYMENT_PROCESS']), paymentController.processPayment);
router.get('/next-voucher-no', authorize(['PAYMENT_VIEW', 'PAYMENT_PROCESS']), paymentController.getNextVoucherNo);
router.get('/journal/next-voucher-no', authorize(['PAYMENT_VIEW', 'PAYMENT_PROCESS']), paymentController.getNextJournalVoucherNo);
router.post('/journal', authorize(['PAYMENT_PROCESS']), paymentController.recordJournalVoucher);
router.get('/journal', authorize(['PAYMENT_VIEW']), paymentController.getJournalVouchers);
router.get('/contra/next-voucher-no', authorize(['PAYMENT_VIEW', 'PAYMENT_PROCESS']), paymentController.getNextContraVoucherNo);
router.post('/contra', authorize(['PAYMENT_PROCESS']), paymentController.recordContraVoucher);
router.get('/contra', authorize(['PAYMENT_VIEW']), paymentController.getContraVouchers);
router.get('/debit-notes/sources', authorize(['PAYMENT_VIEW', 'PAYMENT_PROCESS']), paymentController.getDebitNoteSources);
router.get('/debit-notes/next-voucher-no', authorize(['PAYMENT_VIEW', 'PAYMENT_PROCESS']), paymentController.getNextDebitNoteNo);
router.post('/debit-notes', authorize(['PAYMENT_PROCESS']), paymentController.recordDebitNote);
router.get('/debit-notes', authorize(['PAYMENT_VIEW']), paymentController.getDebitNotes);
router.post('/debit-notes/:id/cancel', authorize(['PAYMENT_EDIT']), paymentController.cancelDebitNote);
router.get('/', authorize(['PAYMENT_VIEW']), paymentController.getPayments);
router.get('/pending', authorize(['PAYMENT_VIEW']), paymentController.getPendingPayments);
router.get('/:paymentId', authorize(['PAYMENT_VIEW']), paymentController.getPaymentById);
router.get('/:paymentId/pdf', authorize(['PAYMENT_VIEW']), paymentController.getPaymentVoucherPDF);
router.get('/vendor-invoice/:id/pdf', authorize(['PAYMENT_VIEW', 'PURCHASE_ORDER_VIEW']), paymentController.getVendorInvoicePDF);
router.post('/vendor-invoice/:id/send-email', authorize(['PAYMENT_PROCESS']), paymentController.sendVendorInvoiceEmail);
router.post('/:paymentId/send-email', authorize(['PAYMENT_PROCESS']), paymentController.sendPaymentVoucherEmail);
router.patch('/:paymentId/status', authorize(['PAYMENT_EDIT']), paymentController.updatePaymentStatus);
router.delete('/:paymentId', authorize(['PAYMENT_EDIT']), paymentController.deletePayment);

module.exports = router;
