const stockEntryService = require('../services/stockEntryService');

const getAllStockEntries = async (req, res) => {
  try {
    const filters = {
      type: req.query.type,
      status: req.query.status,
      warehouseId: req.query.warehouseId
    };
    const entries = await stockEntryService.getAllStockEntries(filters);
    res.json(entries);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const getStockEntryById = async (req, res) => {
  try {
    const entry = await stockEntryService.getStockEntryById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Stock Entry not found' });
    }
    res.json(entry);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const createStockEntry = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await stockEntryService.createStockEntry(req.body, userId);
    res.status(201).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const submitStockEntry = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await stockEntryService.submitStockEntry(req.params.id, userId);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const deleteStockEntry = async (req, res) => {
  try {
    const result = await stockEntryService.deleteStockEntry(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

module.exports = {
  getAllStockEntries,
  getStockEntryById,
  createStockEntry,
  submitStockEntry,
  deleteStockEntry
};
