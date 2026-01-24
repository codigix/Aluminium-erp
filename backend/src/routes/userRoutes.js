const express = require('express');
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authorize(['USER_MANAGE']), userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', authorize(['USER_MANAGE']), userController.updateUser);
router.post('/:id/change-password', userController.changePassword);
router.put('/:id/deactivate', authorize(['USER_MANAGE']), userController.deactivateUser);
router.put('/:id/reactivate', authorize(['USER_MANAGE']), userController.reactivateUser);
router.get('/department/:departmentId/users', authorize(['USER_MANAGE', 'DEPT_MANAGE']), userController.getUsersByDepartment);

module.exports = router;
