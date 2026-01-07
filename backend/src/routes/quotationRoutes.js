const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');

router.post('/', quotationController.createQuotation);
router.get('/', quotationController.getQuotations);
router.get('/stats', quotationController.getQuotationStats);
router.get('/:quotationId', quotationController.getQuotationById);
router.put('/:quotationId', quotationController.updateQuotation);
router.patch('/:quotationId/status', quotationController.updateQuotationStatus);
router.post('/:quotationId/send-email', quotationController.sendQuotationEmail);
router.delete('/:quotationId', quotationController.deleteQuotation);

module.exports = router;
