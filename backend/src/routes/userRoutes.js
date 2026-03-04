const express = require('express');
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authenticate, userController.getAllUsers);
router.get('/:id', authenticate, userController.getUserById);
router.put('/:id', authenticate, userController.updateUser);
router.post('/:id/change-password', authenticate, userController.changePassword);
router.put('/:id/deactivate', authenticate, authorize(['USER_MANAGE']), userController.deactivateUser);
router.put('/:id/reactivate', authenticate, authorize(['USER_MANAGE']), userController.reactivateUser);
router.get('/department/:departmentId/users', authenticate, userController.getUsersByDepartment);

module.exports = router;
