const express = require('express');
const router = express.Router();
const materialRequestController = require('../controllers/materialRequestController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', materialRequestController.getAll);
router.post('/', materialRequestController.create);

module.exports = router;
