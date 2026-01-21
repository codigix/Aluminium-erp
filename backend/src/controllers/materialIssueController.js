const materialIssueService = require('../services/materialIssueService');

const listMaterialIssues = async (req, res) => {
  try {
    const issues = await materialIssueService.listMaterialIssues();
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMaterialIssueById = async (req, res) => {
  try {
    const issue = await materialIssueService.getMaterialIssueById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Material issue not found' });
    res.json(issue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createMaterialIssue = async (req, res) => {
  try {
    const userId = req.user.id;
    const id = await materialIssueService.createMaterialIssue(req.body, userId);
    const newIssue = await materialIssueService.getMaterialIssueById(id);
    res.status(201).json(newIssue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listMaterialIssues,
  getMaterialIssueById,
  createMaterialIssue
};
