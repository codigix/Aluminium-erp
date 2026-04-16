const express = require('express');
const router = express.Router();
const qualityQueueController = require('../controllers/qualityQueueController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(['QC_VIEW']), qualityQueueController.getPendingQualityQueue);
router.post('/', authorize(['PROD_MANAGE', 'QC_EDIT']), qualityQueueController.addToQualityQueue);

module.exports = router;
