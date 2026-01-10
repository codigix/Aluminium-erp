const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');

router.get('/preview/:quotationId', purchaseOrderController.previewPurchaseOrder);
router.post('/', purchaseOrderController.createPurchaseOrder);
router.get('/stats', purchaseOrderController.getPurchaseOrderStats);
router.get('/', purchaseOrderController.getPurchaseOrders);
router.get('/:poId', purchaseOrderController.getPurchaseOrderById);
router.patch('/:poId', purchaseOrderController.updatePurchaseOrder);
router.delete('/:poId', purchaseOrderController.deletePurchaseOrder);

module.exports = router;
