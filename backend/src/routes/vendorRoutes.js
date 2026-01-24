const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');

const { authorize } = require('../middleware/authMiddleware');

router.post('/', authorize(['VENDOR_EDIT']), vendorController.createVendor);
router.get('/', authorize(['VENDOR_VIEW']), vendorController.getVendors);
router.get('/stats', authorize(['VENDOR_VIEW']), vendorController.getVendorStats);
router.get('/:vendorId', authorize(['VENDOR_VIEW']), vendorController.getVendorById);
router.put('/:vendorId', authorize(['VENDOR_EDIT']), vendorController.updateVendor);
router.patch('/:vendorId/status', authorize(['VENDOR_EDIT']), vendorController.updateVendorStatus);
router.delete('/:vendorId', authorize(['VENDOR_EDIT']), vendorController.deleteVendor);

module.exports = router;
