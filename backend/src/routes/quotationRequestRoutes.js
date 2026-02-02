const express = require('express');
const router = express.Router();
const quotationRequestController = require('../controllers/quotationRequestController');
const upload = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(['PO_VIEW']), quotationRequestController.getQuotationRequests);
router.post('/send', authorize(['PO_EDIT']), quotationRequestController.sendQuotationViaEmail);
router.post('/batch-approve', authorize(['PO_EDIT']), upload.single('reply_pdf'), quotationRequestController.batchApproveQuotationRequests);
router.post('/batch-send-to-design', authorize(['PO_EDIT']), quotationRequestController.batchSendToDesign);
router.post('/:id/approve', authorize(['PO_EDIT']), quotationRequestController.approveQuotationRequest);
router.post('/:id/reject', authorize(['PO_EDIT']), quotationRequestController.rejectQuotationRequest);
router.put('/batch-update-rates', authorize(['PO_EDIT']), quotationRequestController.updateQuotationRates);
router.delete('/:id', authorize(['PO_EDIT']), quotationRequestController.deleteQuotationRequest);

module.exports = router;
