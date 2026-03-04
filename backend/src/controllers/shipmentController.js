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

exports.getTrackingDashboard = async (req, res, next) => {
  try {
    const data = await shipmentService.getTrackingDashboard();
    res.json(data);
  } catch (error) {
    next(error);
  }
};

exports.getTrackingHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const history = await shipmentService.getTrackingHistory(id);
    res.json(history);
  } catch (error) {
    next(error);
  }
};

exports.updateTracking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;
    const result = await shipmentService.updateTracking(id, { lat, lng });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.getShipmentDashboard = async (req, res, next) => {
  try {
    const data = await shipmentService.getShipmentDashboard();
    res.json(data);
  } catch (error) {
    next(error);
  }
};

exports.getShipmentReports = async (req, res, next) => {
  try {
    const data = await shipmentService.getShipmentReports();
    res.json(data);
  } catch (error) {
    next(error);
  }
};

exports.deleteShipmentOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await shipmentService.deleteShipmentOrder(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
