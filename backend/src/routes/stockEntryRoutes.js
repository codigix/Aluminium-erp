const express = require('express');
const router = express.Router();
const stockEntryController = require('../controllers/stockEntryController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize(['STOCK_VIEW']), stockEntryController.getAllStockEntries);
router.get('/:id', authenticate, authorize(['STOCK_VIEW']), stockEntryController.getStockEntryById);
router.get('/items-from-grn/:grnId', authenticate, authorize(['STOCK_VIEW']), stockEntryController.getItemsFromGRN);
router.post('/', authenticate, authorize(['STOCK_MANAGE']), stockEntryController.createStockEntry);
router.post('/:id/submit', authenticate, authorize(['STOCK_MANAGE']), stockEntryController.submitStockEntry);
router.delete('/:id', authenticate, authorize(['STOCK_MANAGE']), stockEntryController.deleteStockEntry);

module.exports = router;
