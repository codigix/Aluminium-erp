const express = require('express');
const router = express.Router();
const drawingController = require('../controllers/drawingController');
const { authenticate } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/', authenticate, drawingController.listDrawings);
router.post('/', authenticate, upload.single('file'), drawingController.createDrawing);
router.post('/share/bulk', authenticate, drawingController.shareDrawingsBulk);
router.post('/:id/share', authenticate, drawingController.shareDrawing);
router.delete('/:id', authenticate, drawingController.deleteDrawing);
router.get('/:drawingNo/revisions', authenticate, drawingController.getDrawingRevisions);
router.patch('/:drawingNo', authenticate, upload.single('drawing_pdf'), drawingController.updateDrawing);
router.patch('/items/:itemId', authenticate, upload.single('drawing_pdf'), drawingController.updateItemDrawing);

module.exports = router;
