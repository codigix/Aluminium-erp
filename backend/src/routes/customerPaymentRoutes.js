const express = require('express');
const router = express.Router();
const customerPaymentController = require('../controllers/customerPaymentController');
const creditNoteController = require('../controllers/creditNoteController');
const { authorize } = require('../middleware/authMiddleware');

// Credit Notes (registered before '/:paymentId' routes)
router.get('/credit-notes/sources', authorize(['PAYMENT_VIEW', 'PAYMENT_PROCESS']), creditNoteController.getCreditNoteSources);
router.get('/credit-notes/next-voucher-no', authorize(['PAYMENT_VIEW', 'PAYMENT_PROCESS']), creditNoteController.getNextCreditNoteNo);
router.post('/credit-notes', authorize(['PAYMENT_PROCESS']), creditNoteController.recordCreditNote);
router.get('/credit-notes', authorize(['PAYMENT_VIEW']), creditNoteController.getCreditNotes);
router.post('/credit-notes/:id/cancel', authorize(['PAYMENT_EDIT']), creditNoteController.cancelCreditNote);

router.post('/', authorize(['PAYMENT_PROCESS']), customerPaymentController.recordPaymentReceived);
router.get('/', authorize(['PAYMENT_VIEW']), customerPaymentController.getPaymentsReceived);
router.get('/outstanding', authorize(['PAYMENT_VIEW']), customerPaymentController.getAllOutstandingInvoices);
router.get('/:paymentId', authorize(['PAYMENT_VIEW']), customerPaymentController.getPaymentReceivedById);
router.get('/:paymentId/pdf', authorize(['PAYMENT_VIEW']), customerPaymentController.getCustomerPaymentReceiptPDF);
router.post('/:paymentId/send-email', authorize(['PAYMENT_PROCESS']), customerPaymentController.sendCustomerPaymentReceiptEmail);
router.post('/invoice/:id/send-email', authorize(['PAYMENT_PROCESS']), customerPaymentController.sendCustomerInvoiceEmail);
router.get('/customer/:customerId/balance', authorize(['PAYMENT_VIEW']), customerPaymentController.getCustomerBalance);
router.get('/customer/:customerId/monthly-summary', authorize(['PAYMENT_VIEW']), customerPaymentController.getCustomerMonthlySummary);
router.get('/customer/:customerId/outstanding', authorize(['PAYMENT_VIEW']), customerPaymentController.getOutstandingInvoices);
router.patch('/:paymentId/status', authorize(['PAYMENT_EDIT']), customerPaymentController.updatePaymentStatus);
router.delete('/:paymentId', authorize(['PAYMENT_EDIT']), customerPaymentController.deletePayment);

module.exports = router;
