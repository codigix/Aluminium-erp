const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { DEPARTMENT_ACCESS_RULES } = require('../config/departmentAccessConfig');

exports.authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

exports.authorize = (requiredPermissions = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (requiredPermissions.length === 0) {
        return next();
      }

      // Bypass for SYS_ADMIN (Check token first, then DB as fallback)
      if (req.user.role === 'SYS_ADMIN') {
        return next();
      }

      const query = `
        SELECT p.code FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = ?
      `;

      const [results] = await db.query(query, [req.user.role_id]);
      
      const userPermissions = results && Array.isArray(results) ? results.map(r => r.code) : [];
      
      // Fallback: Check if role is SYS_ADMIN via DB if not in token
      const [roleCheck] = await db.query('SELECT code FROM roles WHERE id = ?', [req.user.role_id]);
      if (roleCheck.length > 0 && roleCheck[0].code === 'SYS_ADMIN') {
        return next();
      }

      console.log('[DEBUG] Auth check:', {
        userId: req.user.id,
        roleId: req.user.role_id,
        role: req.user.role,
        requiredPermissions
      });
      
      console.log('[DEBUG] User permissions count:', results?.length);
      console.log('[DEBUG] User permissions:', userPermissions);
      
      let hasPermission = requiredPermissions.some(perm => userPermissions.includes(perm));

      // Fallback to departmentAccessConfig if database permissions are missing
      if (!hasPermission && req.user.department_code) {
        const deptRules = DEPARTMENT_ACCESS_RULES[req.user.department_code];
        if (deptRules && deptRules.permissions) {
          hasPermission = requiredPermissions.some(perm => deptRules.permissions.includes(perm));
          if (hasPermission) {
            console.log(`[DEBUG] Permission ${requiredPermissions} granted via departmentAccessConfig fallback for ${req.user.department_code}`);
          }
        }
      }

      if (!hasPermission) {
        console.log(`Permission denied for user ${req.user.id} (Role: ${req.user.role_id}). Required: ${requiredPermissions}, User has: ${userPermissions}`);
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

exports.authorizeByDepartment = (allowedDepartments = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (allowedDepartments.length === 0) {
        return next();
      }

      if (!allowedDepartments.includes(req.user.department_id)) {
        return res.status(403).json({ error: 'Access denied for this department' });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

exports.authorizeByDocumentStatus = (statusRules = {}) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const departmentId = req.user.department_id;
      const allowedStatuses = statusRules[departmentId] || [];

      req.allowedStatuses = allowedStatuses;
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

exports.blockInProduction = (req, res, next) => {
  next();
};

