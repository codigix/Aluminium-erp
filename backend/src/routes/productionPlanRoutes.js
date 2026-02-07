const express = require('express');
const router = express.Router();
const productionPlanController = require('../controllers/productionPlanController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(['PROD_VIEW']), productionPlanController.listProductionPlans);
router.get('/next-code', authorize(['PROD_VIEW']), productionPlanController.getNextPlanCode);
router.get('/ready-items', authorize(['PROD_VIEW']), productionPlanController.getReadySalesOrderItems);
router.get('/ready-orders', authorize(['PROD_VIEW']), productionPlanController.getProductionReadySalesOrders);
router.get('/sales-order/:id', authorize(['PROD_VIEW']), productionPlanController.getSalesOrderFullDetails);
router.get('/item-bom/:salesOrderItemId', authorize(['PROD_VIEW']), productionPlanController.getItemBOMDetails);
router.get('/:id', authorize(['PROD_VIEW']), productionPlanController.getProductionPlanById);
router.post('/', authorize(['PROD_MANAGE']), productionPlanController.createProductionPlan);
router.put('/:id', authorize(['PROD_MANAGE']), productionPlanController.updateProductionPlan);
router.delete('/:id', authorize(['PROD_MANAGE']), productionPlanController.deleteProductionPlan);

module.exports = router;
