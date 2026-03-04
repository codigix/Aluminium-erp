const orderService = require('../services/orderService');

const listOrders = async (req, res, next) => {
  try {
    const orders = await orderService.listOrders();
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

const createOrder = async (req, res, next) => {
  try {
    const orderId = await orderService.createOrder(req.body);
    res.status(201).json({ id: orderId, message: 'Sales Order created successfully' });
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    await orderService.updateOrder(req.params.id, req.body);
    res.json({ message: 'Order updated successfully' });
  } catch (error) {
    next(error);
  }
};

const deleteOrder = async (req, res, next) => {
  try {
    await orderService.deleteOrder(req.params.id);
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getApprovedDrawings = async (req, res, next) => {
  try {
    const { company_id } = req.query;
    const rows = await orderService.getApprovedDrawings(company_id);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

const getStats = async (req, res, next) => {
  try {
    const stats = await orderService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listOrders,
  createOrder,
  getOrderById,
  updateOrder,
  deleteOrder,
  getApprovedDrawings,
  getStats
};
