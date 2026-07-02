const express = require('express');
const router = express.Router();
const projectAnalysisController = require('../controllers/projectAnalysisController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware.authenticate, projectAnalysisController.getProjectAnalysis);
router.get('/material-consumption', authMiddleware.authenticate, projectAnalysisController.getMaterialConsumption);
router.get('/:id/drawings', authMiddleware.authenticate, projectAnalysisController.getProjectDrawings);
router.get('/:id/drawing/:drawingNo', authMiddleware.authenticate, projectAnalysisController.getProjectDetailByDrawing);
router.get('/:id', authMiddleware.authenticate, projectAnalysisController.getProjectDetail);

module.exports = router;
