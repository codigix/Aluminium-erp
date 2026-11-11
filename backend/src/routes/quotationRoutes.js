const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const quotationController = require('../controllers/quotationController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.post('/', authorize(['QUOTATION_EDIT']), quotationController.createQuotation);
router.post('/merge', authorize(['QUOTATION_EDIT']), quotationController.mergeQuotations);
router.post('/compare/approve', authorize(['QUOTATION_EDIT']), quotationController.approveComparedQuotations);
router.get('/', authorize(['QUOTATION_VIEW']), quotationController.getQuotations);
router.get('/stats', authorize(['QUOTATION_VIEW']), quotationController.getQuotationStats);

// Admin approval workflow (QUOTATION_APPROVE; System Admin passes automatically)
router.get('/approvals', authorize(['QUOTATION_APPROVE']), quotationController.getQuotationApprovals);
router.get('/approvals/pending-count', authorize(['QUOTATION_APPROVE', 'QUOTATION_VIEW', 'DASHBOARD_VIEW']), quotationController.getPendingApprovalCount);
router.get('/:quotationId/approval-detail', authorize(['QUOTATION_APPROVE']), quotationController.getQuotationApprovalDetail);
router.get('/:quotationId/approval-history', authorize(['QUOTATION_VIEW', 'QUOTATION_APPROVE']), quotationController.getQuotationApprovalHistory);
router.post('/:quotationId/submit-approval', authorize(['QUOTATION_EDIT']), quotationController.submitQuotationForApproval);
router.post('/:quotationId/approve', authorize(['QUOTATION_APPROVE']), quotationController.approveQuotation);
router.post('/:quotationId/reject', authorize(['QUOTATION_APPROVE']), quotationController.rejectQuotation);
router.get('/:quotationId', authorize(['QUOTATION_VIEW']), quotationController.getQuotationById);
router.get('/:quotationId/pdf', authorize(['QUOTATION_VIEW']), quotationController.getQuotationPDF);
router.get('/:quotationId/received-pdf', authorize(['QUOTATION_VIEW']), quotationController.getReceivedQuotationPDF);
router.get('/:quotationId/parse-received-pdf', authorize(['QUOTATION_EDIT']), quotationController.parseReceivedQuotationPDF);
router.post('/parse-pdf', authorize(['QUOTATION_EDIT']), upload.single('pdf'), quotationController.parseQuotationPDF);
router.put('/:quotationId', authorize(['QUOTATION_EDIT']), quotationController.updateQuotation);
router.post('/:quotationId/upload-response', authorize(['QUOTATION_EDIT']), upload.array('pdf', 10), quotationController.uploadVendorResponse);
router.patch('/:quotationId/status', authorize(['QUOTATION_EDIT']), quotationController.updateQuotationStatus);
router.post('/:quotationId/send-email', authorize(['QUOTATION_EDIT']), quotationController.sendQuotationEmail);
router.delete('/:quotationId', authorize(['QUOTATION_EDIT']), quotationController.deleteQuotation);

module.exports = router;
