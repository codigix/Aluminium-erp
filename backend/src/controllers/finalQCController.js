const finalQCService = require('../services/finalQCService');

exports.getOrdersForFinalQC = async (req, res, next) => {
  try {
    const orders = await finalQCService.getOrdersForFinalQC();
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

exports.completeFinalQC = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await finalQCService.completeFinalQC(id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.createShipmentOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await finalQCService.createShipmentOrder(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
