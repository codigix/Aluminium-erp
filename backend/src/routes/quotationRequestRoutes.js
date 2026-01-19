const express = require('express');
const router = express.Router();
const quotationRequestController = require('../controllers/quotationRequestController');

router.get('/', quotationRequestController.getQuotationRequests);
router.post('/send', quotationRequestController.sendQuotationViaEmail);
router.post('/batch-approve', quotationRequestController.batchApproveQuotationRequests);
router.post('/batch-send-to-design', quotationRequestController.batchSendToDesign);
router.post('/:id/approve', quotationRequestController.approveQuotationRequest);
router.post('/:id/reject', quotationRequestController.rejectQuotationRequest);
router.put('/batch-update-rates', quotationRequestController.updateQuotationRates);
router.delete('/:id', quotationRequestController.deleteQuotationRequest);

module.exports = router;
