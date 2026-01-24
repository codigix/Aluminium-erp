const departmentAccessService = require('../services/departmentAccessService');

exports.getAccessibleDocuments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentType } = req.query;

    if (!documentType) {
      return res.status(400).json({ error: 'documentType query parameter required' });
    }

    const documents = await departmentAccessService.getDepartmentDocuments(userId, documentType);
    
    await departmentAccessService.logDocumentAccess(userId, documentType, null, 'list', 'success');

    res.json({
      documentType,
      count: documents.length,
      documents
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.viewDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentType, documentId } = req.params;

    const hasAccess = await departmentAccessService.checkDocumentAccess(userId, documentId, documentType, 'view');

    if (!hasAccess) {
      await departmentAccessService.logDocumentAccess(userId, documentType, documentId, 'view', 'denied');
      return res.status(403).json({ error: 'Access denied to this document' });
    }

    await departmentAccessService.logDocumentAccess(userId, documentType, documentId, 'view', 'success');

    res.json({ message: 'Document access granted', canEdit: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.changeDocumentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentType, documentId } = req.params;
    const { newStatus } = req.body;

    const canTransition = await departmentAccessService.checkStatusTransition(userId, documentId, newStatus, documentType);

    if (!canTransition) {
      await departmentAccessService.logDocumentAccess(userId, documentType, documentId, 'status_change', 'denied');
      return res.status(403).json({ error: 'Cannot transition to this status from your department' });
    }

    await departmentAccessService.logDocumentAccess(userId, documentType, documentId, 'status_change', 'success');

    res.json({ message: 'Status transition allowed', newStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDocumentWorkflow = (req, res) => {
  try {
    const { documentType } = req.params;

    const workflow = departmentAccessService.getWorkflowStatus(documentType);

    if (workflow.length === 0) {
      return res.status(404).json({ error: 'Workflow not found for document type' });
    }

    res.json({
      documentType,
      workflow
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserAccessDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    const dashboard = await departmentAccessService.getAccessDashboard(userId);

    if (!dashboard) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAccessLogs = async (req, res) => {
  try {
    const { limit = 100, offset = 0, userId } = req.query;

    let query = `
      SELECT l.*, u.username, u.first_name, u.last_name 
      FROM document_access_logs l
      LEFT JOIN users u ON l.user_id = u.id
    `;
    const params = [];

    if (userId) {
      query += ` WHERE l.user_id = ?`;
      params.push(userId);
    }

    query += ` ORDER BY l.timestamp DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const db = require('../config/db');
    const [results] = await db.query(query, params);

    res.json({
      logs: results,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
