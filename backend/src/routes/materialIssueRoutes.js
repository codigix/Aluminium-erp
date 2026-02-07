const express = require('express');
const router = express.Router();
const materialIssueController = require('../controllers/materialIssueController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(['PROD_VIEW']), materialIssueController.listMaterialIssues);
router.get('/:id', authorize(['PROD_VIEW']), materialIssueController.getMaterialIssueById);
router.post('/', authorize(['PROD_MANAGE']), materialIssueController.createMaterialIssue);

module.exports = router;
