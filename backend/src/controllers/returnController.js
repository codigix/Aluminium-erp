const returnService = require('../services/returnService');

exports.getReturns = async (req, res, next) => {
  try {
    const returns = await returnService.getReturns();
    res.json(returns);
  } catch (error) {
    next(error);
  }
};

exports.getReturnById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const returnData = await returnService.getReturnById(id);
    if (!returnData) return res.status(404).json({ message: 'Return not found' });
    res.json(returnData);
  } catch (error) {
    next(error);
  }
};

exports.initiateReturn = async (req, res, next) => {
  try {
    const result = await returnService.initiateReturn(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

exports.updateReturnStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await returnService.updateReturnStatus(id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.getReturnStats = async (req, res, next) => {
  try {
    const stats = await returnService.getReturnStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};
