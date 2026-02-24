const express = require('express');
const router = express.Router();
const finalQCController = require('../controllers/finalQCController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/orders', authenticate, authorize(['QC_VIEW']), finalQCController.getOrdersForFinalQC);
router.post('/orders/:id/complete', authenticate, authorize(['QC_EDIT']), finalQCController.completeFinalQC);
router.post('/orders/:id/create-shipment', authenticate, authorize(['QC_EDIT']), finalQCController.createShipmentOrder);

module.exports = router;
