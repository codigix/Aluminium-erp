const shipmentService = require('../services/shipmentService');
const finalQCService = require('../services/finalQCService');

exports.getShipmentOrders = async (req, res, next) => {
  try {
    const orders = await shipmentService.getShipmentOrders();
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

exports.createShipmentOrder = async (req, res, next) => {
  try {
    const { salesOrderId } = req.body;
    if (!salesOrderId) {
      return res.status(400).json({ error: 'salesOrderId is required' });
    }
    const result = await finalQCService.createShipmentOrder(salesOrderId);
    res.status(201).json(result);
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

exports.updateShipmentPlanning = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await shipmentService.updateShipmentPlanning(id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
