const vendorService = require('../services/vendorService');

const createVendor = async (req, res, next) => {
  try {
    const result = await vendorService.createVendor(req.body);
    res.status(201).json({ message: 'Vendor created', data: result });
  } catch (error) {
    next(error);
  }
};

const getVendors = async (req, res, next) => {
  try {
    const vendors = await vendorService.getVendors();
    res.json(vendors);
  } catch (error) {
    next(error);
  }
};

const getVendorById = async (req, res, next) => {
  try {
    const vendor = await vendorService.getVendorById(req.params.vendorId);
    res.json(vendor);
  } catch (error) {
    next(error);
  }
};

const updateVendor = async (req, res, next) => {
  try {
    const result = await vendorService.updateVendor(req.params.vendorId, req.body);
    res.json({ message: 'Vendor updated', data: result });
  } catch (error) {
    next(error);
  }
};

const updateVendorStatus = async (req, res, next) => {
  try {
    const status = await vendorService.updateVendorStatus(req.params.vendorId, req.body.status);
    res.json({ message: 'Status updated', status });
  } catch (error) {
    next(error);
  }
};

const deleteVendor = async (req, res, next) => {
  try {
    await vendorService.deleteVendor(req.params.vendorId);
    res.json({ message: 'Vendor deleted' });
  } catch (error) {
    next(error);
  }
};

const getVendorStats = async (req, res, next) => {
  try {
    const stats = await vendorService.getVendorStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  updateVendorStatus,
  deleteVendor,
  getVendorStats
};
