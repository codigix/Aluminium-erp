const express = require('express');
const router = express.Router();
const deliveryChallanController = require('../controllers/deliveryChallanController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(['ORDER_VIEW']), deliveryChallanController.getDeliveryChallans);
router.get('/:id', authorize(['ORDER_VIEW']), deliveryChallanController.getDeliveryChallanById);
router.patch('/:id', authorize(['ORDER_EDIT', 'STATUS_CHANGE']), deliveryChallanController.updateDeliveryChallan);

module.exports = router;
