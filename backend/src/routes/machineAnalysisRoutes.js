const express = require('express');
const router = express.Router();
const machineAnalysisController = require('../controllers/machineAnalysisController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware.authenticate, machineAnalysisController.getMachineAnalysis);

module.exports = router;
