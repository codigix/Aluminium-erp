const express = require('express');
const router = express.Router();
const projectAnalysisController = require('../controllers/projectAnalysisController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware.authenticate, projectAnalysisController.getProjectAnalysis);

module.exports = router;
