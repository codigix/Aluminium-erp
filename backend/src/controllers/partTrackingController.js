const partTrackingService = require('../services/partTrackingService');

const listDrawings = async (req, res, next) => {
  try {
    const result = await partTrackingService.listDrawings({
      search: req.query.search,
      client: req.query.client,
      type: req.query.type,
      usage: req.query.usage,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      page: req.query.page,
      limit: req.query.limit
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getWhereUsed = async (req, res, next) => {
  try {
    const result = await partTrackingService.getWhereUsed(req.params.drawingNo);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const updateDrawingDetails = async (req, res, next) => {
  try {
    const drawing = await partTrackingService.updateDrawingDetails(req.params.id, req.body);
    res.json({ message: 'Drawing updated successfully', data: drawing });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listDrawings,
  getWhereUsed,
  updateDrawingDetails
};
