const salesInvoiceService = require('../services/salesInvoiceService');

const getAvailableSalesOrders = async (req, res, next) => {
  try {
    const orders = await salesInvoiceService.getAvailableSalesOrders();
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

const getOrderDetailsForInvoice = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const excludeInvoiceId = req.query.excludeInvoiceId || null;
    const details = await salesInvoiceService.getOrderDetailsForInvoice(orderId, excludeInvoiceId);
    res.json(details);
  } catch (error) {
    next(error);
  }
};

const getNextInvoiceNo = async (req, res, next) => {
  try {
    const nextNo = await salesInvoiceService.getNextInvoiceNo();
    res.json({ invoiceNo: nextNo });
  } catch (error) {
    next(error);
  }
};

const createSalesInvoice = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const result = await salesInvoiceService.createSalesInvoice(req.body, userId);
    res.status(201).json({
      success: true,
      message: 'Sales Invoice created successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const listSalesInvoices = async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search,
      status: req.query.status
    };
    const invoices = await salesInvoiceService.listSalesInvoices(filters);
    res.json(invoices);
  } catch (error) {
    next(error);
  }
};

const getSalesInvoiceById = async (req, res, next) => {
  try {
    const invoice = await salesInvoiceService.getSalesInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Sales Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    next(error);
  }
};

const deleteSalesInvoice = async (req, res, next) => {
  try {
    await salesInvoiceService.deleteSalesInvoice(req.params.id);
    res.json({ success: true, message: 'Sales Invoice deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const generateSalesInvoicePDF = async (req, res, next) => {
  try {
    const copyType = req.query.copyType || 'Original for Recipient';
    const pdf = await salesInvoiceService.generateSalesInvoicePDF(req.params.id, copyType);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="tax-invoice-${req.params.id}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
};

const updateSalesInvoice = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const result = await salesInvoiceService.updateSalesInvoice(req.params.id, req.body, userId);
    res.json({
      success: true,
      message: 'Sales Invoice updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const sendInvoiceToAccounts = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const result = await salesInvoiceService.sendInvoiceToAccounts(req.params.id, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const revertInvoiceFromAccounts = async (req, res, next) => {
  try {
    const result = await salesInvoiceService.revertInvoiceFromAccounts(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAvailableSalesOrders,
  getOrderDetailsForInvoice,
  getNextInvoiceNo,
  createSalesInvoice,
  updateSalesInvoice,
  listSalesInvoices,
  getSalesInvoiceById,
  deleteSalesInvoice,
  generateSalesInvoicePDF,
  sendInvoiceToAccounts,
  revertInvoiceFromAccounts
};
