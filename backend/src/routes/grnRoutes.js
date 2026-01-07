const express = require('express');
const router = express.Router();
const grnService = require('../services/grnService');
const { authorizeByDepartment } = require('../middleware/authMiddleware');

router.use(authorizeByDepartment([8]));

router.get('/stats', async (req, res) => {
  try {
    const stats = await grnService.getGRNStats();
    res.json(stats);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const grns = await grnService.getAllGRNs();
    res.json(grns);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/:grnId', async (req, res) => {
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

router.post('/', async (req, res) => {
  try {
    const { poNumber, grnDate, receivedQuantity, notes } = req.body;
    const grn = await grnService.createGRN(poNumber, grnDate, receivedQuantity, notes);
    res.status(201).json(grn);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.patch('/:grnId', async (req, res) => {
  try {
    const grn = await grnService.updateGRN(req.params.grnId, req.body);
    res.json(grn);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.delete('/:grnId', async (req, res) => {
  try {
    const result = await grnService.deleteGRN(req.params.grnId);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

module.exports = router;
