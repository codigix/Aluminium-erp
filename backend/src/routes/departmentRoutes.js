const express = require('express');
const departmentController = require('../controllers/departmentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', departmentController.getAllDepartments);
router.get('/:id', authenticate, departmentController.getDepartmentById);
router.get('/:id/users', authenticate, departmentController.getDepartmentUsers);
router.get('/:id/roles', departmentController.getRolesByDepartment);
router.get('/roles/:roleId/permissions', authenticate, departmentController.getRolePermissions);

module.exports = router;
