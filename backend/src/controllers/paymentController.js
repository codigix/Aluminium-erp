const paymentService = require('../services/paymentService');

const processPayment = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const result = await paymentService.processPayment({
      ...req.body,
      createdBy: userId
    });
    res.status(201).json({
      message: 'Payment processed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getPayments = async (req, res, next) => {
  try {
    const filters = {
      vendorId: req.query.vendorId,
      status: req.query.status,
      paymentMode: req.query.paymentMode,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const payments = await paymentService.getPayments(filters);
    res.json(payments);
  } catch (error) {
    next(error);
  }
};

const getPendingPayments = async (req, res, next) => {
  try {
    const payments = await paymentService.getPendingPayments();
    res.json(payments);
  } catch (error) {
    next(error);
  }
};

const getPaymentById = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.paymentId);
    res.json(payment);
  } catch (error) {
    next(error);
  }
};

const updatePaymentStatus = async (req, res, next) => {
  try {
    const result = await paymentService.updatePaymentStatus(
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
    const result = await paymentService.deletePayment(req.params.paymentId);
    res.json({
      message: 'Payment deleted',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getPaymentVoucherPDF = async (req, res, next) => {
  try {
    const pdfBuffer = await paymentService.generatePaymentVoucherPDF(req.params.paymentId);
    const payment = await paymentService.getPaymentById(req.params.paymentId);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Voucher-${payment.payment_voucher_no}.pdf`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

const sendPaymentVoucherEmail = async (req, res, next) => {
  try {
    const result = await paymentService.sendPaymentVoucherEmail(req.params.paymentId, req.body);
    res.json({
      message: 'Email sent successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  processPayment,
  getPayments,
  getPendingPayments,
  getPaymentById,
  updatePaymentStatus,
  deletePayment,
  getPaymentVoucherPDF,
  sendPaymentVoucherEmail
};
