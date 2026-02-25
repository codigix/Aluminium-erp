const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

const { authorize } = require('../middleware/authMiddleware');

router.get('/', authorize(['DASHBOARD_VIEW']), dashboardController.getDashboard);
router.get('/accounts', authorize(['DASHBOARD_VIEW']), dashboardController.getAccountsDashboard);

module.exports = router;
