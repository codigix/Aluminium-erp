const customerMasterService = require('../services/customerMasterService');

const listCustomers = async (req, res, next) => {
  try {
    const customers = await customerMasterService.listCustomers({
      search: req.query.search,
      status: req.query.status
    });
    res.json(customers);
  } catch (error) {
    next(error);
  }
};

const getCustomerById = async (req, res, next) => {
  try {
    const customer = await customerMasterService.getCustomerById(req.params.id);
    res.json(customer);
  } catch (error) {
    next(error);
  }
};

const createCustomer = async (req, res, next) => {
  try {
    const customer = await customerMasterService.createCustomer(req.body, req.user?.id || null);
    res.status(201).json({ message: 'Customer created successfully', data: customer });
  } catch (error) {
    next(error);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    const customer = await customerMasterService.updateCustomer(req.params.id, req.body);
    res.json({ message: 'Customer updated successfully', data: customer });
  } catch (error) {
    next(error);
  }
};

const updateCustomerStatus = async (req, res, next) => {
  try {
    const customer = await customerMasterService.updateCustomerStatus(req.params.id, req.body.status);
    res.json({ message: `Customer marked ${customer.status === 'ACTIVE' ? 'Active' : 'Inactive'}`, data: customer });
  } catch (error) {
    next(error);
  }
};

const deleteCustomer = async (req, res, next) => {
  try {
    const result = await customerMasterService.deleteCustomer(req.params.id);
    res.json({ message: 'Customer deleted successfully', data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  updateCustomerStatus,
  deleteCustomer
};
