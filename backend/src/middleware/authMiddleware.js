const jwt = require('jsonwebtoken');
const db = require('../config/db');

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
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (requiredPermissions.length === 0) {
        return next();
      }

      const query = `
        SELECT p.code FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = ? AND p.code IN (?)
      `;

      db.query(query, [req.user.role_id, requiredPermissions], (err, results) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        const userPermissions = results.map(r => r.code);
        const hasPermission = requiredPermissions.some(perm => userPermissions.includes(perm));

        if (!hasPermission) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
      });
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
