const {
  DEPARTMENT_CODES,
  DOCUMENT_STATUS_FLOW,
  DEPARTMENT_ACCESS_RULES,
  DOCUMENT_WORKFLOW
} = require('../config/departmentAccessConfig');
const db = require('../config/db');

exports.checkDocumentAccess = (userId, documentId, documentType, action) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT u.department_id, d.code as department_code FROM users u
      JOIN departments d ON u.id = u.department_id
      WHERE u.id = ?
    `;

    db.query(query, [userId], (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length === 0) {
        return resolve(false);
      }

      const user = results[0];
      const departmentCode = user.department_code;
      const accessRules = DEPARTMENT_ACCESS_RULES[departmentCode];

      if (!accessRules) {
        return resolve(false);
      }

      if (action === 'view') {
        return resolve(accessRules.canViewDocuments.includes(documentType));
      }

      if (action === 'edit') {
        return resolve(accessRules.canEditDocuments.includes(documentType));
      }

      if (action === 'create') {
        return resolve(accessRules.canCreateDocuments.includes(documentType));
      }

      resolve(false);
    });
  });
};

exports.checkStatusTransition = (userId, documentId, newStatus, documentType) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT u.department_id, d.code as department_code FROM users u
      JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `;

    db.query(query, [userId], (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length === 0) {
        return resolve(false);
      }

      const user = results[0];
      const departmentCode = user.department_code;
      const accessRules = DEPARTMENT_ACCESS_RULES[departmentCode];

      if (!accessRules) {
        return resolve(false);
      }

      const canTransition = accessRules.canChangeStatusTo.includes(newStatus);
      resolve(canTransition);
    });
  });
};

exports.getDepartmentDocuments = (userId, documentType) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT u.department_id, d.code as department_code FROM users u
      JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `;

    db.query(query, [userId], (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length === 0) {
        return resolve([]);
      }

      const user = results[0];
      const departmentCode = user.department_code;
      const accessRules = DEPARTMENT_ACCESS_RULES[departmentCode];

      if (!accessRules || !accessRules.canViewDocuments.includes(documentType)) {
        return resolve([]);
      }

      const allowedStatuses = accessRules.canAccessStatuses;

      if (documentType === 'sales_orders') {
        const docQuery = `
          SELECT * FROM sales_orders WHERE status IN (?) ORDER BY created_at DESC
        `;
        db.query(docQuery, [allowedStatuses], (err, docs) => {
          if (err) return reject(err);
          resolve(docs);
        });
      } else if (documentType === 'customer_pos') {
        const docQuery = `
          SELECT * FROM customer_pos WHERE status IN (?) ORDER BY created_at DESC
        `;
        db.query(docQuery, [allowedStatuses], (err, docs) => {
          if (err) return reject(err);
          resolve(docs);
        });
      } else {
        resolve([]);
      }
    });
  });
};

exports.getWorkflowStatus = (documentType) => {
  const workflow = DOCUMENT_WORKFLOW[documentType];
  if (!workflow) {
    return [];
  }
  return workflow.map(stage => ({
    status: stage.status,
    department: stage.department,
    description: stage.description
  }));
};

exports.logDocumentAccess = (userId, documentType, documentId, action, status) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO document_access_logs (user_id, document_type, document_id, action, status)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(query, [userId, documentType, documentId, action, status], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

exports.getAccessDashboard = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT u.id, u.username, d.name as department_name, d.code as department_code,
             r.name as role_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `;

    db.query(query, [userId], (err, results) => {
      if (err) return reject(err);

      if (results.length === 0) {
        return resolve(null);
      }

      const user = results[0];
      const departmentCode = user.department_code;
      const accessRules = DEPARTMENT_ACCESS_RULES[departmentCode];

      resolve({
        user,
        accessRules,
        workflow: DOCUMENT_WORKFLOW
      });
    });
  });
};
