const express = require('express');
const router = express.Router();
const rfqController = require('../controllers/rfqController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/', authenticate, rfqController.createRfq);
router.get('/', authenticate, rfqController.getRfqs);
router.get('/mr/:mrId', authenticate, rfqController.getRfqsByMrId);

module.exports = router;
