const express = require('express');
const departmentController = require('../controllers/departmentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (needed for Sign Up)
router.get('/', departmentController.getAllDepartments);
router.get('/:id/roles', departmentController.getRolesByDepartment);

// Private routes
router.get('/:id', authenticate, authorize(['DEPT_MANAGE', 'USER_MANAGE']), departmentController.getDepartmentById);
router.get('/:id/users', authenticate, authorize(['DEPT_MANAGE', 'USER_MANAGE']), departmentController.getDepartmentUsers);
router.get('/roles/:roleId/permissions', authenticate, authorize(['DEPT_MANAGE', 'USER_MANAGE']), departmentController.getRolePermissions);

module.exports = router;
