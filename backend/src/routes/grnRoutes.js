const express = require('express');
const router = express.Router();
const grnService = require('../services/grnService');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/stats', authenticate, authorize(['GRN_VIEW']), async (req, res) => {
  try {
    const stats = await grnService.getGRNStats();
    res.json(stats);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/', authenticate, authorize(['GRN_VIEW']), async (req, res) => {
  try {
    const grns = await grnService.getAllGRNs();
    res.json(grns);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/:grnId', authenticate, authorize(['GRN_VIEW']), async (req, res) => {
  try {
    const grn = await grnService.getGRNWithDetails(req.params.grnId);
    if (!grn) {
      return res.status(404).json({ message: 'GRN not found' });
    }
    res.json(grn);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.post('/', authenticate, authorize(['GRN_CREATE']), async (req, res) => {
  try {
    const { poNumber, grnDate, receivedQuantity, notes } = req.body;
    const grn = await grnService.createGRN(poNumber, grnDate, receivedQuantity, notes);
    res.status(201).json(grn);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.patch('/:grnId', authenticate, authorize(['GRN_EDIT']), async (req, res) => {
  try {
    const grn = await grnService.updateGRN(req.params.grnId, req.body);
    res.json(grn);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.delete('/:grnId', authenticate, authorize(['GRN_DELETE']), async (req, res) => {
  try {
    const result = await grnService.deleteGRN(req.params.grnId);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

module.exports = router;
