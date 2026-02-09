const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const { authorize } = require('../middleware/authMiddleware');

router.post('/', authorize(['STOCK_MANAGE']), warehouseController.createWarehouse);
router.get('/', authorize(['STOCK_VIEW']), warehouseController.getWarehouses);
router.get('/:id', authorize(['STOCK_VIEW']), warehouseController.getWarehouseById);
router.put('/:id', authorize(['STOCK_MANAGE']), warehouseController.updateWarehouse);
router.delete('/:id', authorize(['STOCK_MANAGE']), warehouseController.deleteWarehouse);

module.exports = router;
