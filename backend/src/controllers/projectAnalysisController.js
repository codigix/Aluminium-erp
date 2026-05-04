const projectAnalysisService = require('../services/projectAnalysisService');

const getProjectAnalysis = async (req, res, next) => {
  try {
    const stats = await projectAnalysisService.getProjectAnalysisStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

const getProjectDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const details = await projectAnalysisService.getProjectDetailAnalysis(id);
    res.json(details);
  } catch (error) {
    next(error);
  }
};

const getMaterialConsumption = async (req, res, next) => {
  try {
    const stats = await projectAnalysisService.getMaterialConsumptionStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjectAnalysis,
  getProjectDetail,
  getMaterialConsumption
};
