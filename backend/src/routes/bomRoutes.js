const express = require('express');
const router = express.Router();
const bomController = require('../controllers/bomController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/items/:itemId', authenticate, bomController.getItemMaterials);
router.post('/items/:itemId', authenticate, bomController.addItemMaterial);
router.put('/materials/:id', authenticate, bomController.updateItemMaterial);
router.delete('/materials/:id', authenticate, bomController.deleteItemMaterial);
router.get('/sales-order/:salesOrderId', authenticate, bomController.getBOMBySalesOrder);

module.exports = router;
