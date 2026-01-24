const express = require('express');
const router = express.Router();
const jobCardController = require('../controllers/jobCardController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(['PROD_VIEW']), jobCardController.listJobCards);
router.post('/', authorize(['PROD_MANAGE']), jobCardController.createJobCard);
router.patch('/:id/progress', authorize(['PROD_MANAGE']), jobCardController.updateProgress);

module.exports = router;
