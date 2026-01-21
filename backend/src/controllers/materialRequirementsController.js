const materialRequirementsService = require('../services/materialRequirementsService');

const getGlobalRequirements = async (req, res) => {
  try {
    const requirements = await materialRequirementsService.getMaterialRequirements();
    res.json(requirements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProjectRequirements = async (req, res) => {
  try {
    const { projectId } = req.params;
    const requirements = await materialRequirementsService.getProjectMaterialRequirements(projectId);
    res.json(requirements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getGlobalRequirements,
  getProjectRequirements
};
