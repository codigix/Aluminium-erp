const express = require('express');
const router = express.Router();
const warehouseAllocationController = require('../controllers/warehouseAllocationController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/pending', authenticate, warehouseAllocationController.getPendingAllocations);
router.post('/allocate', authenticate, warehouseAllocationController.allocateWarehouse);

module.exports = router;
