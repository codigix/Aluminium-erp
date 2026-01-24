const express = require('express');
const router = express.Router();
const warehouseAllocationController = require('../controllers/warehouseAllocationController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/pending', authorize(['STOCK_VIEW']), warehouseAllocationController.getPendingAllocations);
router.post('/allocate', authorize(['STOCK_MANAGE']), warehouseAllocationController.allocateWarehouse);

module.exports = router;
