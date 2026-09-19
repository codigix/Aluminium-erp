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
router.get('/sales-order/:id/bulk-preview', authorize(['PROD_VIEW']), productionPlanController.getBulkCreationPreview);
router.get('/item-bom/:salesOrderItemId', authorize(['PROD_VIEW']), productionPlanController.getItemBOMDetails);
router.get('/:id', authorize(['PROD_VIEW']), productionPlanController.getProductionPlanById);
router.post('/bulk', authorize(['PROD_MANAGE']), productionPlanController.bulkCreateProductionPlans);
router.post('/bulk-material-request-preview', authorize(['PROD_VIEW']), productionPlanController.getBulkMaterialRequestPreview);
router.post('/bulk-material-request', authorize(['PROD_MANAGE']), productionPlanController.bulkCreateMaterialRequests);
router.post('/', authorize(['PROD_MANAGE']), productionPlanController.createProductionPlan);
router.put('/:id', authorize(['PROD_MANAGE']), productionPlanController.updateProductionPlan);
router.post('/transmit-mr/:id', authorize(['PROD_MANAGE']), productionPlanController.createMaterialRequestFromPlan);
router.get('/material-request-items/:id', authorize(['PROD_VIEW']), productionPlanController.getMaterialRequestItemsForPlan);
router.post('/:id/materials', authorize(['PROD_MANAGE']), productionPlanController.addManualMaterial);
router.delete('/:id/materials/:materialId', authorize(['PROD_MANAGE']), productionPlanController.removeManualMaterial);
router.delete('/:id', authorize(['PROD_MANAGE']), productionPlanController.deleteProductionPlan);

module.exports = router;
