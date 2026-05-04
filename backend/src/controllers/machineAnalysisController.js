const machineAnalysisService = require('../services/machineAnalysisService');

const getMachineAnalysis = async (req, res, next) => {
  try {
    const stats = await machineAnalysisService.getMachineAnalysisStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMachineAnalysis
};
