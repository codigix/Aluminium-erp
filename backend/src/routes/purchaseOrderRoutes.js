const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');

const { authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/material-requests', authorize(['PURCHASE_ORDER_VIEW']), purchaseOrderController.getPOMaterialRequests);
// PO Admin approval (approve / reject are Admin-only: PO_APPROVE; System Admin bypasses)
router.get('/approvals', authorize(['PO_APPROVE']), purchaseOrderController.getPOApprovals);
router.get('/approvals/pending-count', authorize(['PO_APPROVE', 'PURCHASE_ORDER_VIEW']), purchaseOrderController.getPOPendingApprovalCount);
router.post('/bulk-submit-approval', authorize(['PURCHASE_ORDER_EDIT']), purchaseOrderController.bulkSubmitPOsForApproval);
router.post('/bulk-approve', authorize(['PO_APPROVE']), purchaseOrderController.bulkApprovePurchaseOrders);
router.get('/:poId/approval-detail', authorize(['PO_APPROVE']), purchaseOrderController.getPOApprovalDetail);
router.get('/:poId/approval-history', authorize(['PURCHASE_ORDER_VIEW', 'PO_APPROVE']), purchaseOrderController.getPOApprovalHistory);
router.post('/:poId/submit-approval', authorize(['PURCHASE_ORDER_EDIT']), purchaseOrderController.submitPOForApproval);
router.post('/:poId/reject', authorize(['PO_APPROVE']), purchaseOrderController.rejectPurchaseOrder);
router.patch('/:poId/send-to-payment', authorize(['PAYMENT_PROCESS']), purchaseOrderController.sendToPendingPayment);
router.put('/:poId/send-to-accounts', authorize(['PURCHASE_ORDER_EDIT']), purchaseOrderController.forwardToAccounts);
router.post('/:poId/invoice', authorize(['PURCHASE_ORDER_EDIT']), upload.array('invoice', 10), purchaseOrderController.uploadInvoice);
router.post('/:poId/store-acceptance', authorize(['PURCHASE_ORDER_EDIT']), purchaseOrderController.handleStoreAcceptance);
router.post('/:poId/approve', authorize(['PO_APPROVE']), purchaseOrderController.approvePurchaseOrder);
router.get('/:poId/pdf', authorize(['PURCHASE_ORDER_VIEW']), purchaseOrderController.getPurchaseOrderPDF);
router.post('/:poId/send-email', authorize(['PURCHASE_ORDER_EDIT', 'PURCHASE_ORDER_VIEW', 'PAYMENT_PROCESS']), purchaseOrderController.sendPurchaseOrderEmail);
router.get('/next-number', authorize(['PURCHASE_ORDER_CREATE', 'PURCHASE_ORDER_VIEW']), purchaseOrderController.getNextPONumber);
router.get('/drawing-numbers', authorize(['PURCHASE_ORDER_CREATE', 'PURCHASE_ORDER_VIEW']), purchaseOrderController.getAvailableDrawingNumbers);
router.get('/preview/:quotationId', authorize(['PURCHASE_ORDER_CREATE']), purchaseOrderController.previewPurchaseOrder);
router.post('/merge', authorize(['PURCHASE_ORDER_CREATE']), purchaseOrderController.mergePurchaseOrders);
router.post('/direct-company', authorize(['PURCHASE_ORDER_CREATE']), upload.array('attachments', 10), purchaseOrderController.createDirectCompanyPurchaseOrder);
router.post('/', authorize(['PURCHASE_ORDER_CREATE']), purchaseOrderController.createPurchaseOrder);
router.get('/stats', authorize(['PURCHASE_ORDER_VIEW']), purchaseOrderController.getPurchaseOrderStats);
router.get('/', authorize(['PURCHASE_ORDER_VIEW']), purchaseOrderController.getPurchaseOrders);
router.get('/:poId', authorize(['PURCHASE_ORDER_VIEW']), purchaseOrderController.getPurchaseOrderById);
router.patch('/:poId', authorize(['PURCHASE_ORDER_EDIT']), purchaseOrderController.updatePurchaseOrder);
router.delete('/:poId', authorize(['PURCHASE_ORDER_DELETE', 'PAYMENT_EDIT']), purchaseOrderController.deletePurchaseOrder);

module.exports = router;
