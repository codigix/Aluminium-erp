const oeeAnalysisService = require('../services/oeeAnalysisService');

const getOEEMetrics = async (req, res) => {
  try {
    const { range } = req.query;
    const metrics = await oeeAnalysisService.getOEEMetrics(range);
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching OEE metrics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getOEEMetrics
};
