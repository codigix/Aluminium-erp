const express = require('express');
const router = express.Router();
const voucherAdminController = require('../controllers/voucherAdminController');
const { authorize } = require('../middleware/authMiddleware');

// Payment History edit / cancel. :kind = receipt | payment | journal | contra | debit-note | credit-note
router.get('/:kind/:id/cancel-preview', authorize(['PAYMENT_EDIT']), voucherAdminController.previewCancel);
router.post('/:kind/:id/cancel', authorize(['PAYMENT_EDIT']), voucherAdminController.cancelVoucher);
router.put('/:kind/:id', authorize(['PAYMENT_EDIT']), voucherAdminController.updateVoucher);
// Full edit of a receipt / payment on the voucher entry screen (same voucher no.)
router.get('/:kind/:id/edit-data', authorize(['PAYMENT_EDIT']), voucherAdminController.getEditData);
router.put('/:kind/:id/replace', authorize(['PAYMENT_EDIT']), voucherAdminController.replaceVoucher);
router.get('/:kind/:id/audit', authorize(['PAYMENT_VIEW', 'PAYMENT_EDIT']), voucherAdminController.getAuditTrail);

module.exports = router;
