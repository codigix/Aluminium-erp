const express = require('express');
const router = express.Router();
const operationService = require('../services/operationService');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize(['PROD_VIEW', 'DESIGN_VIEW', 'DESIGN_MANAGE']), async (req, res) => {
  try {
    const operations = await operationService.getAllOperations();
    res.json(operations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/next-code', authenticate, authorize(['PROD_VIEW', 'DESIGN_VIEW', 'DESIGN_MANAGE']), async (req, res) => {
  try {
    const nextCode = await operationService.generateOperationCode();
    res.json({ nextCode });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authenticate, authorize(['PROD_MANAGE']), async (req, res) => {
  try {
    const operation = await operationService.createOperation(req.body);
    res.status(201).json(operation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', authenticate, authorize(['PROD_MANAGE']), async (req, res) => {
  try {
    const operation = await operationService.updateOperation(req.params.id, req.body);
    res.json(operation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authenticate, authorize(['PROD_MANAGE']), async (req, res) => {
  try {
    await operationService.deleteOperation(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
