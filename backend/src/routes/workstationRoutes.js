const express = require('express');
const router = express.Router();
const workstationService = require('../services/workstationService');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(['PROD_VIEW']), async (req, res) => {
  try {
    const workstations = await workstationService.getAllWorkstations();
    res.json(workstations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/next-code', authorize(['PROD_VIEW']), async (req, res) => {
  try {
    const nextCode = await workstationService.generateWorkstationCode();
    res.json({ nextCode });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authorize(['PROD_MANAGE']), async (req, res) => {
  try {
    const workstation = await workstationService.createWorkstation(req.body);
    res.status(201).json(workstation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', authorize(['PROD_MANAGE']), async (req, res) => {
  try {
    const workstation = await workstationService.updateWorkstation(req.params.id, req.body);
    res.json(workstation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authorize(['PROD_MANAGE']), async (req, res) => {
  try {
    await workstationService.deleteWorkstation(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
