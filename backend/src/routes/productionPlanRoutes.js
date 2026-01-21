const express = require('express');
const router = express.Router();
const productionPlanController = require('../controllers/productionPlanController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', productionPlanController.listProductionPlans);
router.get('/next-code', productionPlanController.getNextPlanCode);
router.get('/ready-items', productionPlanController.getReadySalesOrderItems);
router.get('/ready-orders', productionPlanController.getProductionReadySalesOrders);
router.get('/sales-order/:id', productionPlanController.getSalesOrderFullDetails);
router.get('/:id', productionPlanController.getProductionPlanById);
router.post('/', productionPlanController.createProductionPlan);

module.exports = router;
