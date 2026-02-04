const express = require('express');
const router = express.Router();
const workOrderController = require('../controllers/workOrderController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(['PROD_VIEW']), workOrderController.listWorkOrders);
router.post('/', authorize(['PROD_MANAGE']), workOrderController.createWorkOrder);
router.post('/create-from-plan/:planId', authorize(['PROD_MANAGE']), workOrderController.createWorkOrdersFromPlan);
router.get('/next-number', authorize(['PROD_VIEW']), workOrderController.getNextWoNumber);
router.patch('/:id/status', authorize(['PROD_MANAGE']), workOrderController.updateStatus);
router.delete('/:id', authorize(['PROD_MANAGE']), workOrderController.deleteWorkOrder);

module.exports = router;
