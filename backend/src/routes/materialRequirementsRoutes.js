const express = require('express');
const router = express.Router();
const materialRequirementsController = require('../controllers/materialRequirementsController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/global', materialRequirementsController.getGlobalRequirements);
router.get('/project/:projectId', materialRequirementsController.getProjectRequirements);

module.exports = router;
