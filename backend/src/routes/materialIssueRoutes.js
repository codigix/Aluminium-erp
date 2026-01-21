const express = require('express');
const router = express.Router();
const materialIssueController = require('../controllers/materialIssueController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', materialIssueController.listMaterialIssues);
router.get('/:id', materialIssueController.getMaterialIssueById);
router.post('/', materialIssueController.createMaterialIssue);

module.exports = router;
