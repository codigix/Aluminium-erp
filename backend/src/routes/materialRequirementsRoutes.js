const express = require('express');
const router = express.Router();
const materialRequirementsController = require('../controllers/materialRequirementsController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);
router.use(authorize(['PROD_VIEW']));

router.get('/global', materialRequirementsController.getGlobalRequirements);
router.get('/project/:projectId', materialRequirementsController.getProjectRequirements);

module.exports = router;
