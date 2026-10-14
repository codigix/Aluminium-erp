const express = require('express');
const router = express.Router();
const controller = require('../controllers/productionReportController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

// All reports are read-only and accept ?from=YYYY-MM-DD&to=YYYY-MM-DD where a date range applies.
// Add ?format=csv to download the main table of a report.
router.get('/workspace', authorize(['PROD_VIEW']), controller.workspace);
router.get('/summary', authorize(['PROD_VIEW']), controller.summary);
router.get('/plan-vs-actual', authorize(['PROD_VIEW']), controller.planVsActual);
router.get('/job-cards', authorize(['PROD_VIEW']), controller.jobCards);
router.get('/utilisation', authorize(['PROD_VIEW']), controller.utilisation);
router.get('/quality-rework', authorize(['PROD_VIEW', 'QC_VIEW']), controller.quality);
router.get('/material-variance', authorize(['PROD_VIEW']), controller.materials);
router.get('/shipments', authorize(['PROD_VIEW']), controller.shipments);
router.get('/delayed', authorize(['PROD_VIEW']), controller.delayed);

module.exports = router;
