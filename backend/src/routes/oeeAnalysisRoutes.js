const express = require('express');
const router = express.Router();
const oeeAnalysisController = require('../controllers/oeeAnalysisController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware.authenticate, oeeAnalysisController.getOEEMetrics);

module.exports = router;
