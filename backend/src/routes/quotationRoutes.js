const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.post('/', authorize(['QUOTATION_EDIT']), quotationController.createQuotation);
router.get('/', authorize(['QUOTATION_VIEW']), quotationController.getQuotations);
router.get('/stats', authorize(['QUOTATION_VIEW']), quotationController.getQuotationStats);
router.get('/:quotationId', authorize(['QUOTATION_VIEW']), quotationController.getQuotationById);
router.get('/:quotationId/pdf', authorize(['QUOTATION_VIEW']), quotationController.getQuotationPDF);
router.put('/:quotationId', authorize(['QUOTATION_EDIT']), quotationController.updateQuotation);
router.patch('/:quotationId/status', authorize(['QUOTATION_EDIT']), quotationController.updateQuotationStatus);
router.post('/:quotationId/send-email', authorize(['QUOTATION_EDIT']), quotationController.sendQuotationEmail);
router.delete('/:quotationId', authorize(['QUOTATION_EDIT']), quotationController.deleteQuotation);

module.exports = router;
