const warehouseAllocationService = require('../services/warehouseAllocationService');

const getPendingAllocations = async (req, res) => {
  try {
    const allocations = await warehouseAllocationService.getPendingAllocations();
    res.json(allocations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const allocateWarehouse = async (req, res) => {
  try {
    const result = await warehouseAllocationService.allocateWarehouse(req.body, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getPendingAllocations,
  allocateWarehouse
};
