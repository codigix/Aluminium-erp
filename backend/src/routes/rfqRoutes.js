const express = require('express');
const router = express.Router();
const rfqController = require('../controllers/rfqController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/', authenticate, rfqController.createRfq);
router.get('/', authenticate, rfqController.getRfqs);
router.get('/mr/:mrId', authenticate, rfqController.getRfqsByMrId);
router.get('/:id', authenticate, rfqController.getRfqById);
router.put('/:id/assign-vendors', authenticate, rfqController.assignItemVendors);
router.delete('/:id', authenticate, rfqController.deleteRfq);

module.exports = router;
