const express = require('express');
const router = express.Router();
const bomController = require('../controllers/bomController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/approved', authenticate, bomController.getApprovedBOMs);
router.get('/items/:itemId', authenticate, bomController.getItemMaterials);
router.post('/items/:itemId/materials', authenticate, bomController.addItemMaterial);
router.post('/items/:itemId/components', authenticate, bomController.addComponent);
router.post('/items/:itemId/operations', authenticate, bomController.addOperation);
router.post('/items/:itemId/scrap', authenticate, bomController.addScrap);

router.put('/materials/:id', authenticate, bomController.updateItemMaterial);
router.delete('/materials/:id', authenticate, bomController.deleteItemMaterial);
router.delete('/components/:id', authenticate, bomController.deleteComponent);
router.delete('/operations/:id', authenticate, bomController.deleteOperation);
router.delete('/scrap/:id', authenticate, bomController.deleteScrap);
router.get('/sales-order/:salesOrderId', authenticate, bomController.getBOMBySalesOrder);
router.post('/createRequest', authenticate, bomController.createBOMRequest);

router.delete('/items/:itemId', authenticate, bomController.deleteBOM);

module.exports = router;
