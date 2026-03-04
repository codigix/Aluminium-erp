const {
  DEPARTMENT_CODES,
  DOCUMENT_STATUS_FLOW,
  DEPARTMENT_ACCESS_RULES,
  DOCUMENT_WORKFLOW
} = require('../config/departmentAccessConfig');
const db = require('../config/db');

exports.checkDocumentAccess = async (userId, documentId, documentType, action) => {
  try {
    const query = `
      SELECT u.department_id, d.code as department_code FROM users u
      JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `;

    const [results] = await db.query(query, [userId]);

    if (results.length === 0) {
      return false;
    }

    const user = results[0];
    const departmentCode = user.department_code;
    const accessRules = DEPARTMENT_ACCESS_RULES[departmentCode];

    if (!accessRules) {
      return false;
    }

    if (action === 'view') {
      return accessRules.canViewDocuments.includes(documentType);
    }

    if (action === 'edit') {
      return accessRules.canEditDocuments.includes(documentType);
    }

    if (action === 'create') {
      return accessRules.canCreateDocuments.includes(documentType);
    }

    return false;
  } catch (error) {
    console.error('checkDocumentAccess error:', error);
    throw error;
  }
};

exports.checkStatusTransition = async (userId, documentId, newStatus, documentType) => {
  try {
    const query = `
      SELECT u.department_id, d.code as department_code FROM users u
      JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `;

    const [results] = await db.query(query, [userId]);

    if (results.length === 0) {
      return false;
    }

    const user = results[0];
    const departmentCode = user.department_code;
    const accessRules = DEPARTMENT_ACCESS_RULES[departmentCode];

    if (!accessRules) {
      return false;
    }

    const canTransition = accessRules.canChangeStatusTo.includes(newStatus);
    return canTransition;
  } catch (error) {
    console.error('checkStatusTransition error:', error);
    throw error;
  }
};

exports.getDepartmentDocuments = async (userId, documentType) => {
  try {
    const query = `
      SELECT u.department_id, d.code as department_code FROM users u
      JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `;

    const [results] = await db.query(query, [userId]);

    if (results.length === 0) {
      return [];
    }

    const user = results[0];
    const departmentCode = user.department_code;
    const accessRules = DEPARTMENT_ACCESS_RULES[departmentCode];

    if (!accessRules || !accessRules.canViewDocuments.includes(documentType)) {
      return [];
    }

    const allowedStatuses = accessRules.canAccessStatuses;

    if (documentType === 'sales_orders') {
      const docQuery = `
        SELECT * FROM sales_orders WHERE status IN (?) ORDER BY created_at DESC
      `;
      const [docs] = await db.query(docQuery, [allowedStatuses]);
      return docs;
    } else if (documentType === 'customer_pos') {
      const docQuery = `
        SELECT * FROM customer_pos WHERE status IN (?) ORDER BY created_at DESC
      `;
      const [docs] = await db.query(docQuery, [allowedStatuses]);
      return docs;
    } else {
      return [];
    }
  } catch (error) {
    console.error('getDepartmentDocuments error:', error);
    throw error;
  }
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

exports.logDocumentAccess = async (userId, documentType, documentId, action, status) => {
  try {
    const query = `
      INSERT INTO document_access_logs (user_id, document_type, document_id, action, status)
      VALUES (?, ?, ?, ?, ?)
    `;

    const [results] = await db.query(query, [userId, documentType, documentId, action, status]);
    return results;
  } catch (error) {
    console.error('logDocumentAccess error:', error);
    throw error;
  }
};

exports.getAccessDashboard = async (userId) => {
  try {
    const query = `
      SELECT u.id, u.username, d.name as department_name, d.code as department_code,
             r.name as role_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `;

    const [results] = await db.query(query, [userId]);

    if (results.length === 0) {
      return null;
    }

    const user = results[0];
    const departmentCode = user.department_code;
    const accessRules = DEPARTMENT_ACCESS_RULES[departmentCode];

    return {
      user,
      accessRules,
      workflow: DOCUMENT_WORKFLOW
    };
  } catch (error) {
    console.error('getAccessDashboard error:', error);
    throw error;
  }
};
