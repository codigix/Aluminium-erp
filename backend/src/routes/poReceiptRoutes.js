const express = require('express');
const router = express.Router();
const poReceiptController = require('../controllers/poReceiptController');

router.post('/', poReceiptController.createPOReceipt);
router.get('/stats', poReceiptController.getPOReceiptStats);
router.get('/', poReceiptController.getPOReceipts);
router.get('/:receiptId', poReceiptController.getPOReceiptById);
router.patch('/:receiptId', poReceiptController.updatePOReceipt);
router.delete('/:receiptId', poReceiptController.deletePOReceipt);
router.get('/:receiptId/pdf', poReceiptController.generatePOReceiptPdf);

module.exports = router;
