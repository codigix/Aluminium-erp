const express = require('express');
const router = express.Router();
const workOrderController = require('../controllers/workOrderController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', workOrderController.listWorkOrders);
router.post('/', workOrderController.createWorkOrder);
router.get('/next-number', workOrderController.getNextWoNumber);
router.patch('/:id/status', workOrderController.updateStatus);

module.exports = router;
