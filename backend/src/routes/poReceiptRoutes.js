const express = require('express');
const router = express.Router();
const poReceiptController = require('../controllers/poReceiptController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.post('/', authorize(['PURCHASE_ORDER_EDIT']), poReceiptController.createPOReceipt);
router.get('/stats', authorize(['PURCHASE_ORDER_VIEW']), poReceiptController.getPOReceiptStats);
router.get('/', authorize(['PURCHASE_ORDER_VIEW']), poReceiptController.getPOReceipts);
router.get('/:receiptId', authorize(['PURCHASE_ORDER_VIEW']), poReceiptController.getPOReceiptById);
router.patch('/:receiptId', authorize(['PURCHASE_ORDER_EDIT']), poReceiptController.updatePOReceipt);
router.delete('/:receiptId', authorize(['PURCHASE_ORDER_EDIT']), poReceiptController.deletePOReceipt);
router.get('/:receiptId/pdf', authorize(['PURCHASE_ORDER_VIEW']), poReceiptController.generatePOReceiptPdf);

module.exports = router;
