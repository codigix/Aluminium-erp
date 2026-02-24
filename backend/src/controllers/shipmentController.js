const shipmentService = require('../services/shipmentService');

exports.getShipmentOrders = async (req, res, next) => {
  try {
    const orders = await shipmentService.getShipmentOrders();
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

exports.getShipmentOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await shipmentService.getShipmentOrderById(id);
    if (!order) {
      return res.status(404).json({ message: 'Shipment order not found' });
    }
    res.json(order);
  } catch (error) {
    next(error);
  }
};

exports.updateShipmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await shipmentService.updateShipmentStatus(id, status);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
