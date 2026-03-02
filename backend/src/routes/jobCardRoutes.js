const express = require('express');
const router = express.Router();
const jobCardController = require('../controllers/jobCardController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(['PROD_VIEW']), jobCardController.listJobCards);
router.post('/', authorize(['PROD_MANAGE']), jobCardController.createJobCard);
router.put('/:id', authorize(['PROD_MANAGE']), jobCardController.updateJobCard);
router.delete('/:id', authorize(['PROD_MANAGE', 'QC_EDIT']), jobCardController.deleteJobCard);
router.patch('/:id/progress', authorize(['PROD_MANAGE']), jobCardController.updateProgress);

// Detailed logs
router.get('/:id/logs', authorize(['PROD_VIEW']), jobCardController.getJobCardLogs);

router.post('/:id/time-logs', authorize(['PROD_MANAGE']), jobCardController.addTimeLog);
router.put('/time-logs/:logId', authorize(['PROD_MANAGE']), jobCardController.updateTimeLog);
router.delete('/time-logs/:logId', authorize(['PROD_MANAGE']), jobCardController.deleteTimeLog);

router.post('/:id/quality-logs', authorize(['PROD_MANAGE']), jobCardController.addQualityLog);
router.put('/quality-logs/:logId', authorize(['PROD_MANAGE']), jobCardController.updateQualityLog);
router.delete('/quality-logs/:logId', authorize(['PROD_MANAGE']), jobCardController.deleteQualityLog);

router.post('/:id/downtime-logs', authorize(['PROD_MANAGE']), jobCardController.addDowntimeLog);
router.delete('/downtime-logs/:logId', authorize(['PROD_MANAGE']), jobCardController.deleteDowntimeLog);

module.exports = router;
