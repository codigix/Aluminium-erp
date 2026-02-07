const express = require('express');
const authController = require('../controllers/AuthController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify', authController.verifyToken);
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;
