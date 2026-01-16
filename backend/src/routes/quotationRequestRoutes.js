const express = require('express');
const router = express.Router();
const quotationRequestController = require('../controllers/quotationRequestController');

router.get('/', quotationRequestController.getQuotationRequests);
router.post('/send', quotationRequestController.sendQuotationViaEmail);
router.post('/:id/approve', quotationRequestController.approveQuotationRequest);
router.post('/:id/reject', quotationRequestController.rejectQuotationRequest);
router.delete('/:id', quotationRequestController.deleteQuotationRequest);

module.exports = router;
