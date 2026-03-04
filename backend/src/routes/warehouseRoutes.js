const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.post('/', authenticate, authorize(['STOCK_MANAGE']), warehouseController.createWarehouse);
router.get('/', authenticate, authorize(['STOCK_VIEW']), warehouseController.getWarehouses);
router.get('/:id', authenticate, authorize(['STOCK_VIEW']), warehouseController.getWarehouseById);
router.put('/:id', authenticate, authorize(['STOCK_MANAGE']), warehouseController.updateWarehouse);
router.delete('/:id', authenticate, authorize(['STOCK_MANAGE']), warehouseController.deleteWarehouse);

module.exports = router;
