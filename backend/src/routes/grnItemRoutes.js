const express = require('express');
const router = express.Router();
const grnItemController = require('../controllers/grnItemController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.post('/create-with-items', authorize(['GRN_CREATE']), grnItemController.createGRNWithItems);

router.get('/:grnId/details', authorize(['GRN_VIEW']), grnItemController.getGRNItemDetails);

router.get('/:grnId/summary', authorize(['GRN_VIEW']), grnItemController.getGRNSummary);

router.patch('/:grnItemId', authorize(['GRN_EDIT']), grnItemController.updateGRNItem);

router.post('/:grnItemId/approve-excess', authorize(['GRN_EDIT']), grnItemController.approveExcessQuantity);

router.post('/:grnItemId/reject-excess', authorize(['GRN_EDIT']), grnItemController.rejectExcessQuantity);

router.get('/po/:poId/balance', authorize(['GRN_VIEW', 'PURCHASE_ORDER_VIEW']), grnItemController.getPOBalance);

router.get('/po-item/:poItemId/balance', authorize(['GRN_VIEW', 'PURCHASE_ORDER_VIEW']), grnItemController.getItemBalance);

router.get('/po/:poId/receipt-history', authorize(['GRN_VIEW', 'PURCHASE_ORDER_VIEW']), grnItemController.getPOReceiptHistory);

router.post('/validate', authorize(['GRN_CREATE', 'GRN_EDIT']), grnItemController.validateGRNInput);

router.get('/:grnId/inventory-ledger', authorize(['STOCK_VIEW']), grnItemController.getInventoryLedger);

router.delete('/:grnItemId', authorize(['GRN_EDIT']), grnItemController.deleteGRNItem);

module.exports = router;
