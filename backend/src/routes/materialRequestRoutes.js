const express = require('express');
const router = express.Router();
const materialRequestController = require('../controllers/materialRequestController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

// Material requests are raised by Production, issued by Inventory and sourced by Procurement
const MR_VIEW = ['PROD_VIEW', 'STOCK_VIEW', 'PURCHASE_ORDER_VIEW'];
const MR_EDIT = ['PROD_MANAGE', 'STOCK_MANAGE', 'PURCHASE_ORDER_CREATE', 'PURCHASE_ORDER_EDIT'];

router.post('/bulk-create-rfq-preview', authorize(['PURCHASE_ORDER_CREATE', 'PURCHASE_ORDER_VIEW']), materialRequestController.bulkCreateRfqPreview);
router.post('/bulk-create-rfq', authorize(['PURCHASE_ORDER_CREATE']), materialRequestController.bulkCreateRfq);

router.get('/', authorize(MR_VIEW), materialRequestController.getAll);
router.get('/:id', authorize(MR_VIEW), materialRequestController.getById);
router.patch('/:id/status', authorize(MR_EDIT), materialRequestController.updateStatus);
router.put('/:id/warehouse', authorize(MR_EDIT), materialRequestController.updateWarehouse);
router.post('/:id/items', authorize(MR_EDIT), materialRequestController.addItem);
router.post('/', authorize(MR_EDIT), materialRequestController.create);
router.delete('/:id/items/:itemId', authorize(MR_EDIT), materialRequestController.deleteItem);
router.delete('/:id', authorize(MR_EDIT), materialRequestController.delete);

module.exports = router;
