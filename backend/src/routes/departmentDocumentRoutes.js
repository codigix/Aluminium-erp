const express = require('express');
const departmentDocumentController = require('../controllers/departmentDocumentController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/documents', authenticate, departmentDocumentController.getAccessibleDocuments);
router.get('/document/:documentType/:documentId/view', authenticate, departmentDocumentController.viewDocument);
router.post('/document/:documentType/:documentId/status', authenticate, departmentDocumentController.changeDocumentStatus);
router.get('/workflow/:documentType', authenticate, departmentDocumentController.getDocumentWorkflow);
router.get('/dashboard', authenticate, departmentDocumentController.getUserAccessDashboard);
router.get('/logs', authenticate, departmentDocumentController.getAccessLogs);

module.exports = router;
