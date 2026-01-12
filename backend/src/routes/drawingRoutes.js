const express = require('express');
const router = express.Router();
const drawingController = require('../controllers/drawingController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, drawingController.listDrawings);
router.get('/:drawingNo/revisions', authenticate, drawingController.getDrawingRevisions);

module.exports = router;
