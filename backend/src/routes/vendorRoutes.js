const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');

router.post('/', vendorController.createVendor);
router.get('/', vendorController.getVendors);
router.get('/stats', vendorController.getVendorStats);
router.get('/:vendorId', vendorController.getVendorById);
router.put('/:vendorId', vendorController.updateVendor);
router.patch('/:vendorId/status', vendorController.updateVendorStatus);
router.delete('/:vendorId', vendorController.deleteVendor);

module.exports = router;
