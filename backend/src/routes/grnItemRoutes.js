const express = require('express');
const router = express.Router();
const grnItemController = require('../controllers/grnItemController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.post('/create-with-items', grnItemController.createGRNWithItems);

router.get('/:grnId/details', grnItemController.getGRNItemDetails);

router.get('/:grnId/summary', grnItemController.getGRNSummary);

router.patch('/:grnItemId', grnItemController.updateGRNItem);

router.post('/:grnItemId/approve-excess', grnItemController.approveExcessQuantity);

router.post('/:grnItemId/reject-excess', grnItemController.rejectExcessQuantity);

router.get('/po/:poId/balance', grnItemController.getPOBalance);

router.get('/po-item/:poItemId/balance', grnItemController.getItemBalance);

router.get('/po/:poId/receipt-history', grnItemController.getPOReceiptHistory);

router.post('/validate', grnItemController.validateGRNInput);

router.get('/:grnId/inventory-ledger', grnItemController.getInventoryLedger);

router.delete('/:grnItemId', grnItemController.deleteGRNItem);

module.exports = router;
