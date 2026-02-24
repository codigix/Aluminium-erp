const customerPaymentService = require('../services/customerPaymentService');

const recordPaymentReceived = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const result = await customerPaymentService.recordPaymentReceived({
      ...req.body,
      createdBy: userId
    });
    res.status(201).json({
      message: 'Payment received and recorded successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getPaymentsReceived = async (req, res, next) => {
  try {
    const filters = {
      customerId: req.query.customerId,
      status: req.query.status,
      paymentMode: req.query.paymentMode,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const payments = await customerPaymentService.getPaymentsReceived(filters);
    res.json(payments);
  } catch (error) {
    next(error);
  }
};

const getPaymentReceivedById = async (req, res, next) => {
  try {
    const payment = await customerPaymentService.getPaymentReceivedById(req.params.paymentId);
    res.json(payment);
  } catch (error) {
    next(error);
  }
};

const getCustomerBalance = async (req, res, next) => {
  try {
    const balance = await customerPaymentService.getCustomerBalance(req.params.customerId);
    res.json(balance);
  } catch (error) {
    next(error);
  }
};

const getOutstandingInvoices = async (req, res, next) => {
  try {
    const invoices = await customerPaymentService.getOutstandingInvoices(req.params.customerId);
    res.json(invoices);
  } catch (error) {
    next(error);
  }
};

const getAllOutstandingInvoices = async (req, res, next) => {
  try {
    const invoices = await customerPaymentService.getAllOutstandingInvoices();
    res.json(invoices);
  } catch (error) {
    next(error);
  }
};

const updatePaymentStatus = async (req, res, next) => {
  try {
    const result = await customerPaymentService.updatePaymentStatus(
      req.params.paymentId,
      req.body.status
    );
    res.json({
      message: 'Payment status updated',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const deletePayment = async (req, res, next) => {
  try {
    const result = await customerPaymentService.deletePayment(req.params.paymentId);
    res.json({
      message: 'Payment deleted',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  recordPaymentReceived,
  getPaymentsReceived,
  getPaymentReceivedById,
  getCustomerBalance,
  getOutstandingInvoices,
  getAllOutstandingInvoices, // Added
  updatePaymentStatus,
  deletePayment
};
