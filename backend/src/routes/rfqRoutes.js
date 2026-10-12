const express = require('express');
const router = express.Router();
const rfqController = require('../controllers/rfqController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

const RFQ_VIEW = ['PURCHASE_ORDER_VIEW', 'PURCHASE_ORDER_CREATE'];
const RFQ_EDIT = ['PURCHASE_ORDER_CREATE', 'PURCHASE_ORDER_EDIT'];

router.post('/', authorize(RFQ_EDIT), rfqController.createRfq);
router.get('/', authorize(RFQ_VIEW), rfqController.getRfqs);
router.get('/mr/:mrId', authorize(RFQ_VIEW), rfqController.getRfqsByMrId);

// Merge RFQ endpoints
router.get('/merge/vendors', authorize(RFQ_VIEW), rfqController.getMergeEligibleVendors);
router.get('/merge/eligible', authorize(RFQ_VIEW), rfqController.getMergeEligibleRfqs);
router.post('/merge', authorize(RFQ_EDIT), rfqController.mergeRfqs);

router.get('/:id', authorize(RFQ_VIEW), rfqController.getRfqById);
router.put('/:id/assign-vendors', authorize(RFQ_EDIT), rfqController.assignItemVendors);
router.delete('/:id', authorize(['PURCHASE_ORDER_DELETE', 'PURCHASE_ORDER_EDIT']), rfqController.deleteRfq);

module.exports = router;
