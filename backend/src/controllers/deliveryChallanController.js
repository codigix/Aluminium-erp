const deliveryChallanService = require('../services/deliveryChallanService');

exports.getDeliveryChallans = async (req, res, next) => {
  try {
    const challans = await deliveryChallanService.getDeliveryChallans();
    res.json(challans);
  } catch (error) {
    next(error);
  }
};

exports.getDeliveryChallanById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const challan = await deliveryChallanService.getDeliveryChallanById(id);
    if (!challan) {
      return res.status(404).json({ message: 'Delivery challan not found' });
    }
    res.json(challan);
  } catch (error) {
    next(error);
  }
};

exports.updateDeliveryChallan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await deliveryChallanService.updateDeliveryChallan(id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
