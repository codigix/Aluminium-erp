const quotationService = require('../services/quotationService');

const createQuotation = async (req, res, next) => {
  try {
    const result = await quotationService.createQuotation(req.body);
    res.status(201).json({ message: 'Quotation created', data: result });
  } catch (error) {
    next(error);
  }
};

const getQuotations = async (req, res, next) => {
  try {
    const quotations = await quotationService.getQuotations(req.query);
    res.json(quotations);
  } catch (error) {
    next(error);
  }
};

const getQuotationById = async (req, res, next) => {
  try {
    const quotation = await quotationService.getQuotationById(req.params.quotationId);
    res.json(quotation);
  } catch (error) {
    next(error);
  }
};

const updateQuotation = async (req, res, next) => {
  try {
    const result = await quotationService.updateQuotation(req.params.quotationId, req.body);
    res.json({ message: 'Quotation updated', data: result });
  } catch (error) {
    next(error);
  }
};

const updateQuotationStatus = async (req, res, next) => {
  try {
    const status = await quotationService.updateQuotationStatus(req.params.quotationId, req.body.status);
    res.json({ message: 'Status updated', status });
  } catch (error) {
    next(error);
  }
};

const deleteQuotation = async (req, res, next) => {
  try {
    await quotationService.deleteQuotation(req.params.quotationId);
    res.json({ message: 'Quotation deleted' });
  } catch (error) {
    next(error);
  }
};

const getQuotationStats = async (req, res, next) => {
  try {
    const stats = await quotationService.getQuotationStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

const sendQuotationEmail = async (req, res, next) => {
  try {
    const { to, subject, message, attachPDF } = req.body;
    const result = await quotationService.sendQuotationEmail(req.params.quotationId, {
      to,
      subject,
      message,
      attachPDF
    });
    res.json({ message: 'Email sent successfully', data: result });
  } catch (error) {
    next(error);
  }
};

const getQuotationPDF = async (req, res, next) => {
  try {
    const pdfBuffer = await quotationService.generateQuotationPDF(req.params.quotationId);
    const quotation = await quotationService.getQuotationById(req.params.quotationId);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Quotation_${quotation.quote_number}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  updateQuotationStatus,
  deleteQuotation,
  getQuotationStats,
  sendQuotationEmail,
  getQuotationPDF
};
