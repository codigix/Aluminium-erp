const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');

const { authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/material-requests', authorize(['PURCHASE_ORDER_VIEW']), purchaseOrderController.getPOMaterialRequests);
router.patch('/:poId/send-to-payment', authorize(['PAYMENT_PROCESS']), purchaseOrderController.sendToPendingPayment);
router.post('/:poId/invoice', authorize(['PURCHASE_ORDER_EDIT']), upload.single('invoice'), purchaseOrderController.uploadInvoice);
router.post('/:poId/store-acceptance', authorize(['PURCHASE_ORDER_EDIT']), purchaseOrderController.handleStoreAcceptance);
router.post('/:poId/approve', authorize(['PURCHASE_ORDER_EDIT']), purchaseOrderController.approvePurchaseOrder);
router.get('/:poId/pdf', authorize(['PURCHASE_ORDER_VIEW']), purchaseOrderController.getPurchaseOrderPDF);
router.post('/:poId/send-email', authorize(['PURCHASE_ORDER_EDIT', 'PURCHASE_ORDER_VIEW', 'PAYMENT_PROCESS']), purchaseOrderController.sendPurchaseOrderEmail);
router.get('/preview/:quotationId', authorize(['PURCHASE_ORDER_CREATE']), purchaseOrderController.previewPurchaseOrder);
router.post('/', authorize(['PURCHASE_ORDER_CREATE']), purchaseOrderController.createPurchaseOrder);
router.get('/stats', authorize(['PURCHASE_ORDER_VIEW']), purchaseOrderController.getPurchaseOrderStats);
router.get('/', authorize(['PURCHASE_ORDER_VIEW']), purchaseOrderController.getPurchaseOrders);
router.get('/:poId', authorize(['PURCHASE_ORDER_VIEW']), purchaseOrderController.getPurchaseOrderById);
router.patch('/:poId', authorize(['PURCHASE_ORDER_EDIT']), purchaseOrderController.updatePurchaseOrder);
router.delete('/:poId', authorize(['PURCHASE_ORDER_DELETE']), purchaseOrderController.deletePurchaseOrder);

module.exports = router;
