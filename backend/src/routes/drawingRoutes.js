const express = require('express');
const router = express.Router();
const drawingController = require('../controllers/drawingController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/', authorize(['DESIGN_VIEW', 'PROD_VIEW']), drawingController.listDrawings);
router.get('/approved', authorize(['DESIGN_VIEW', 'PROD_VIEW']), drawingController.getApprovedDrawings);
router.get('/:id/autofetch-details', authorize(['DESIGN_VIEW', 'PROD_VIEW']), drawingController.getDrawingAutofetchDetails);
router.get('/:id', authorize(['DESIGN_VIEW', 'PROD_VIEW']), drawingController.getDrawingById);
router.post('/', authorize(['DESIGN_MANAGE']), upload.fields([{ name: 'file', maxCount: 20 }, { name: 'zipFile', maxCount: 1 }]), drawingController.createDrawing);
router.post('/share/bulk', authorize(['DESIGN_MANAGE']), drawingController.shareDrawingsBulk);
router.post('/delete/bulk', authorize(['DESIGN_MANAGE']), drawingController.deleteDrawingsBulk);
router.post('/:id/share', authorize(['DESIGN_MANAGE']), drawingController.shareDrawing);
router.delete('/:id', authorize(['DESIGN_MANAGE']), drawingController.deleteDrawing);
router.get('/:drawingNo/revisions', authorize(['DESIGN_VIEW', 'PROD_VIEW']), drawingController.getDrawingRevisions);
router.patch('/:id', authorize(['DESIGN_MANAGE']), upload.fields([{ name: 'drawing_pdf', maxCount: 20 }]), drawingController.updateDrawing);
router.patch('/items/:itemId', authorize(['DESIGN_MANAGE']), upload.single('drawing_pdf'), drawingController.updateItemDrawing);

module.exports = router;
