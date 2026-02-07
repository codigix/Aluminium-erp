const express = require('express');
const router = express.Router();
const drawingController = require('../controllers/drawingController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/', authorize(['DESIGN_VIEW', 'PROD_VIEW']), drawingController.listDrawings);
router.post('/', authorize(['DESIGN_MANAGE']), upload.fields([{ name: 'file', maxCount: 1 }, { name: 'zipFile', maxCount: 1 }]), drawingController.createDrawing);
router.post('/share/bulk', authorize(['DESIGN_MANAGE']), drawingController.shareDrawingsBulk);
router.post('/:id/share', authorize(['DESIGN_MANAGE']), drawingController.shareDrawing);
router.delete('/:id', authorize(['DESIGN_MANAGE']), drawingController.deleteDrawing);
router.get('/:drawingNo/revisions', authorize(['DESIGN_VIEW', 'PROD_VIEW']), drawingController.getDrawingRevisions);
router.patch('/:drawingNo', authorize(['DESIGN_MANAGE']), upload.single('drawing_pdf'), drawingController.updateDrawing);
router.patch('/items/:itemId', authorize(['DESIGN_MANAGE']), upload.single('drawing_pdf'), drawingController.updateItemDrawing);

module.exports = router;
