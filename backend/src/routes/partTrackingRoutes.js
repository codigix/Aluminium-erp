const express = require('express');
const router = express.Router();
const partTrackingController = require('../controllers/partTrackingController');
const { authorize } = require('../middleware/authMiddleware');

// Part Tracking (Sales). Read: Sales / Design viewers. Edit (safe drawing fields only): Sales PO editors and Design managers.
const VIEW = ['PO_VIEW', 'COMPANY_VIEW', 'DESIGN_VIEW'];
const EDIT = ['PO_EDIT', 'DESIGN_MANAGE'];

router.get('/', authorize(VIEW), partTrackingController.listDrawings);
router.get('/where-used/:drawingNo', authorize(VIEW), partTrackingController.getWhereUsed);
router.patch('/drawings/:id', authorize(EDIT), partTrackingController.updateDrawingDetails);

module.exports = router;
