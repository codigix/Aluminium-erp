const express = require('express');
const router = express.Router();
const bomController = require('../controllers/bomController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/approved', authenticate, authorize(['BOM_VIEW', 'PROD_VIEW']), bomController.getApprovedBOMs);
router.get('/items/:itemId', authenticate, authorize(['BOM_VIEW', 'PROD_VIEW']), bomController.getItemMaterials);
router.post('/items/:itemId/materials', authenticate, authorize(['BOM_MANAGE']), bomController.addItemMaterial);
router.post('/items/:itemId/components', authenticate, authorize(['BOM_MANAGE']), bomController.addComponent);
router.post('/items/:itemId/operations', authenticate, authorize(['BOM_MANAGE']), bomController.addOperation);
router.post('/items/:itemId/scrap', authenticate, authorize(['BOM_MANAGE']), bomController.addScrap);

router.put('/materials/:id', authenticate, authorize(['BOM_MANAGE']), bomController.updateItemMaterial);
router.delete('/materials/:id', authenticate, authorize(['BOM_MANAGE']), bomController.deleteItemMaterial);
router.delete('/components/:id', authenticate, authorize(['BOM_MANAGE']), bomController.deleteComponent);
router.delete('/operations/:id', authenticate, authorize(['BOM_MANAGE']), bomController.deleteOperation);
router.delete('/scrap/:id', authenticate, authorize(['BOM_MANAGE']), bomController.deleteScrap);
router.get('/sales-order/:salesOrderId', authenticate, authorize(['BOM_VIEW', 'PROD_VIEW']), bomController.getBOMBySalesOrder);
router.post('/createRequest', authenticate, authorize(['BOM_MANAGE']), bomController.createBOMRequest);

router.delete('/items/:itemId', authenticate, authorize(['BOM_MANAGE']), bomController.deleteBOM);

module.exports = router;
