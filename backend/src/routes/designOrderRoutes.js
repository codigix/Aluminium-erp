const express = require('express');
const router = express.Router();
const designOrderController = require('../controllers/designOrderController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, designOrderController.listDesignOrders);
router.patch('/:id/status', authenticate, designOrderController.updateStatus);
router.delete('/:id', authenticate, designOrderController.deleteOrder);

module.exports = router;
