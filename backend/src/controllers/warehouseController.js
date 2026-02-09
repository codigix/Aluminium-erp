const warehouseService = require('../services/warehouseService');

const createWarehouse = async (req, res, next) => {
  try {
    const result = await warehouseService.createWarehouse(req.body);
    res.status(201).json({ message: 'Warehouse created', data: result });
  } catch (error) {
    next(error);
  }
};

const getWarehouses = async (req, res, next) => {
  try {
    const warehouses = await warehouseService.getWarehouses();
    res.json(warehouses);
  } catch (error) {
    next(error);
  }
};

const getWarehouseById = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.getWarehouseById(req.params.id);
    res.json(warehouse);
  } catch (error) {
    next(error);
  }
};

const updateWarehouse = async (req, res, next) => {
  try {
    const result = await warehouseService.updateWarehouse(req.params.id, req.body);
    res.json({ message: 'Warehouse updated', data: result });
  } catch (error) {
    next(error);
  }
};

const deleteWarehouse = async (req, res, next) => {
  try {
    await warehouseService.deleteWarehouse(req.params.id);
    res.json({ message: 'Warehouse deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWarehouse,
  getWarehouses,
  getWarehouseById,
  updateWarehouse,
  deleteWarehouse
};
