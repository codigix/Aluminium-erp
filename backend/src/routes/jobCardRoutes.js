const express = require('express');
const router = express.Router();
const jobCardController = require('../controllers/jobCardController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.use(authenticate);

// Literal routes first to avoid collisions with :id
router.get('/vendor-receipts', authorize(['PAYMENT_VIEW', 'PO_VIEW']), jobCardController.getVendorReceipts);
router.get('/vendor-receipts/:logId/items', authorize(['PAYMENT_VIEW', 'PO_VIEW']), jobCardController.getVendorReceiptItems);
router.patch('/vendor-receipts/:logId/send-to-payment', authorize(['PAYMENT_MANAGE', 'PAYMENT_PROCESS']), jobCardController.sendVendorReceiptToPayment);
router.get('/active-allocations', authorize(['PROD_VIEW', 'QC_VIEW']), jobCardController.getActiveAllocations);

router.get('/', authorize(['PROD_VIEW', 'QC_VIEW']), jobCardController.listJobCards);
router.get('/:id/details', authorize(['PROD_VIEW', 'QC_VIEW']), jobCardController.getJobCardDetails);
router.post('/', authorize(['PROD_MANAGE']), jobCardController.createJobCard);
router.put('/:id', authorize(['PROD_MANAGE']), jobCardController.updateJobCard);
router.delete('/:id', authorize(['PROD_MANAGE']), jobCardController.deleteJobCard);
router.patch('/:id/progress', authorize(['PROD_MANAGE']), jobCardController.updateProgress);

// Detailed logs
router.get('/:id/logs', authorize(['PROD_VIEW', 'QC_VIEW']), jobCardController.getJobCardLogs);
router.get('/work-order/:workOrderId/logs', authorize(['PROD_VIEW', 'QC_VIEW']), jobCardController.getWorkOrderLogs);

router.post('/:id/time-logs', authorize(['PROD_MANAGE']), jobCardController.addTimeLog);
router.put('/time-logs/:logId', authorize(['PROD_MANAGE']), jobCardController.updateTimeLog);
router.delete('/time-logs/:logId', authorize(['PROD_MANAGE']), jobCardController.deleteTimeLog);

router.get('/quality-logs/:logId/download', authorize(['PROD_VIEW', 'QC_VIEW']), jobCardController.downloadQualityReport);
router.post('/:id/quality-logs', authorize(['PROD_MANAGE', 'QC_CREATE', 'QC_EDIT']), upload.single('vendorInvoice'), jobCardController.addQualityLog);
router.put('/quality-logs/:logId', authorize(['PROD_MANAGE', 'QC_EDIT']), jobCardController.updateQualityLog);
router.delete('/quality-logs/:logId', authorize(['PROD_MANAGE', 'QC_EDIT']), jobCardController.deleteQualityLog);

router.post('/:id/downtime-logs', authorize(['PROD_MANAGE']), jobCardController.addDowntimeLog);
router.delete('/downtime-logs/:logId', authorize(['PROD_MANAGE']), jobCardController.deleteDowntimeLog);

module.exports = router;
