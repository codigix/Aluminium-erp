const express = require('express');
const router = express.Router();
const vendorInvoiceController = require('../controllers/vendorInvoiceController');
const { authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/', authorize(['PAYMENT_VIEW']), vendorInvoiceController.getVendorInvoices);
router.get('/:id', authorize(['PAYMENT_VIEW']), vendorInvoiceController.getVendorInvoiceById);
router.put('/:id', authorize(['PAYMENT_PROCESS']), upload.array('invoiceFile', 5), vendorInvoiceController.updateInvoiceDetails);
router.post('/:id/verify', authorize(['PAYMENT_PROCESS']), vendorInvoiceController.verifyInvoice);
router.delete('/:id', authorize(['PAYMENT_PROCESS', 'PAYMENT_VIEW']), vendorInvoiceController.deleteVendorInvoice);
router.post('/:id/revert-from-accounts', authorize(['PAYMENT_PROCESS', 'PAYMENT_VIEW']), vendorInvoiceController.deleteVendorInvoice);

module.exports = router;

