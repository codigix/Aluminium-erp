const drawingService = require('../services/drawingService');

const listDrawings = async (req, res, next) => {
  try {
    const { search } = req.query;
    const drawings = await drawingService.listDrawings(search);
    res.json(drawings);
  } catch (error) {
    next(error);
  }
};

const getDrawingRevisions = async (req, res, next) => {
  try {
    const revisions = await drawingService.getDrawingRevisions(req.params.drawingNo);
    res.json(revisions);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listDrawings,
  getDrawingRevisions
};
