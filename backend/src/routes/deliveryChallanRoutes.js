const express = require('express');
const router = express.Router();
const deliveryChallanController = require('../controllers/deliveryChallanController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', deliveryChallanController.getDeliveryChallans);
router.get('/:id', deliveryChallanController.getDeliveryChallanById);
router.patch('/:id', deliveryChallanController.updateDeliveryChallan);

module.exports = router;
