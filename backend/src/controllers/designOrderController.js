const designOrderService = require('../services/designOrderService');

const listDesignOrders = async (req, res) => {
  try {
    const includeAll = req.query.includeAll === 'true';
    const orders = await designOrderService.listDesignOrders({ includeAll });
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

const getDesignOrderItemsBySalesOrder = async (req, res) => {
  try {
    const { salesOrderId } = req.params;
    const items = await designOrderService.getDesignOrderItemsBySalesOrder(salesOrderId);
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const listBulkRequests = async (req, res) => {
  try {
    const requests = await designOrderService.listBulkRequests();
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveBulkRequest = async (req, res) => {
  try {
    const { id } = req.params;
    await designOrderService.approveBulkRequest(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const rejectBulkRequest = async (req, res) => {
  try {
    const { id } = req.params;
    await designOrderService.rejectBulkRequest(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const searchDesignOrders = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      res.json([]);
      return;
    }
    const results = await designOrderService.searchDesignOrders(q);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listDesignOrders,
  searchDesignOrders,
  updateStatus,
  deleteOrder,
  getDesignOrderItemsBySalesOrder,
  listBulkRequests,
  approveBulkRequest,
  rejectBulkRequest
};
