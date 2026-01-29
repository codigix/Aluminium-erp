const express = require('express');
const router = express.Router();
const quotationCommunicationController = require('../controllers/quotationCommunicationController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', quotationCommunicationController.getCommunications);
router.post('/', quotationCommunicationController.sendCommunication);
router.post('/mark-as-read', quotationCommunicationController.markAsRead);
router.get('/unread-counts', quotationCommunicationController.getUnreadCounts);
router.post('/sync', quotationCommunicationController.syncEmails);

module.exports = router;