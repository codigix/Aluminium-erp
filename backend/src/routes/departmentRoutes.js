const express = require('express');
const departmentController = require('../controllers/departmentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', departmentController.getAllDepartments);
router.get('/:id', authenticate, authorize(['DEPT_MANAGE', 'USER_MANAGE']), departmentController.getDepartmentById);
router.get('/:id/users', authenticate, authorize(['DEPT_MANAGE', 'USER_MANAGE']), departmentController.getDepartmentUsers);
router.get('/:id/roles', authenticate, authorize(['DEPT_MANAGE', 'USER_MANAGE']), departmentController.getRolesByDepartment);
router.get('/roles/:roleId/permissions', authenticate, authorize(['DEPT_MANAGE', 'USER_MANAGE']), departmentController.getRolePermissions);

module.exports = router;
