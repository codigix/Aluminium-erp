const designOrderService = require('../services/designOrderService');

const listDesignOrders = async (req, res) => {
  try {
    const orders = await designOrderService.listDesignOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await designOrderService.updateDesignOrderStatus(id, status);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    await designOrderService.deleteDesignOrder(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listDesignOrders,
  updateStatus,
  deleteOrder
};
