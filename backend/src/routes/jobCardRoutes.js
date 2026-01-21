const express = require('express');
const router = express.Router();
const jobCardController = require('../controllers/jobCardController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', jobCardController.listJobCards);
router.post('/', jobCardController.createJobCard);
router.patch('/:id/progress', jobCardController.updateProgress);

module.exports = router;
