const express = require('express');
const router = express.Router();
const qcService = require('../services/qcInspectionsService');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/stats', authenticate, authorize(['QC_VIEW']), async (req, res) => {
  try {
    const stats = await qcService.getQCStats();
    res.json(stats);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/', authenticate, authorize(['QC_VIEW']), async (req, res) => {
  try {
    const qcs = await qcService.getAllQCs();
    res.json(qcs);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/:qcId', authenticate, authorize(['QC_VIEW']), async (req, res) => {
  try {
    const qc = await qcService.getQCWithDetails(req.params.qcId);
    if (!qc) {
      return res.status(404).json({ message: 'QC Inspection not found' });
    }
    
    const items = await qcService.getQCItems(req.params.qcId);
    res.json({ ...qc, items });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/:qcId/items', authenticate, authorize(['QC_VIEW']), async (req, res) => {
  try {
    const items = await qcService.getQCItems(req.params.qcId);
    res.json(items);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.patch('/items/:qcItemId', authenticate, authorize(['QC_EDIT']), async (req, res) => {
  try {
    const item = await qcService.updateQCItem(req.params.qcItemId, req.body);
    res.json(item);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.post('/', authenticate, authorize(['QC_CREATE']), async (req, res) => {
  try {
    const { grnId, inspectionDate, passQuantity, failQuantity, defects, remarks } = req.body;
    const qcId = await qcService.createQC(grnId, inspectionDate, passQuantity, failQuantity, defects, remarks);
    const qc = await qcService.getQCWithDetails(qcId);
    res.status(201).json(qc);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.patch('/:qcId', authenticate, authorize(['QC_EDIT']), async (req, res) => {
  try {
    const qc = await qcService.updateQC(req.params.qcId, req.body);
    res.json(qc);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.delete('/:qcId', authenticate, authorize(['QC_EDIT']), async (req, res) => {
  try {
    const result = await qcService.deleteQC(req.params.qcId);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

module.exports = router;
