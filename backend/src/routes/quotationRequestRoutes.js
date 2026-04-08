const express = require('express');
const router = express.Router();
const quotationRequestController = require('../controllers/quotationRequestController');
const upload = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(['PO_VIEW']), quotationRequestController.getQuotationRequests);
router.get('/versions/:id', authorize(['PO_VIEW']), quotationRequestController.getQuotationVersionHistory);
router.get('/download-pdf/:id', authorize(['PO_VIEW']), quotationRequestController.downloadQuotationPDF);
router.post('/send', authorize(['PO_EDIT']), quotationRequestController.sendQuotationViaEmail);
router.post('/batch-approve', authorize(['PO_EDIT']), upload.single('reply_pdf'), quotationRequestController.batchApproveQuotationRequests);
router.post('/batch-upload-reply', authorize(['PO_EDIT']), upload.single('reply_pdf'), quotationRequestController.batchUploadReplyPDF);
router.post('/batch-send-to-design', authorize(['PO_EDIT']), quotationRequestController.batchSendToDesign);
router.post('/:id/approve', authorize(['PO_EDIT']), quotationRequestController.approveQuotationRequest);
router.post('/:id/reject', authorize(['PO_EDIT']), quotationRequestController.rejectQuotationRequest);
router.put('/batch-update-rates', authorize(['PO_EDIT']), quotationRequestController.updateQuotationRates);
router.delete('/batch-delete', authorize(['PO_EDIT']), quotationRequestController.batchDeleteQuotationRequests);
router.delete('/:id', authorize(['PO_EDIT']), quotationRequestController.deleteQuotationRequest);

module.exports = router;
