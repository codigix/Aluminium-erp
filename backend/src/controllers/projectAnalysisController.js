const projectAnalysisService = require('../services/projectAnalysisService');

const getProjectAnalysis = async (req, res, next) => {
  try {
    const stats = await projectAnalysisService.getProjectAnalysisStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjectAnalysis
};
