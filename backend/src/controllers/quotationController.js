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

const uploadVendorResponse = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    await quotationService.updateQuotation(req.params.quotationId, {
      received_pdf_path: filePath
    });
    
    // Auto-mark as RECEIVED if status is currently Sent  or DRAFT
    const quotation = await quotationService.getQuotationById(req.params.quotationId);
    if (['Sent ', 'DRAFT', 'EMAIL_RECEIVED'].includes(quotation.status)) {
      await quotationService.updateQuotationStatus(req.params.quotationId, 'RECEIVED');
    }
    
    res.json({ message: 'Vendor response uploaded successfully', path: filePath });
  } catch (error) {
    next(error);
  }
};

const parseQuotationPDF = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const items = await quotationService.parseVendorQuotationPDF(req.file.path);
    res.json(items);
  } catch (error) {
    next(error);
  }
};

const getReceivedQuotationPDF = async (req, res, next) => {
  try {
    const quotation = await quotationService.getQuotationById(req.params.quotationId);
    if (!quotation.received_pdf_path) {
      return res.status(404).json({ error: 'Received PDF not found' });
    }
    
    const fs = require('fs');
    const path = require('path');
    const absolutePath = path.isAbsolute(quotation.received_pdf_path) 
      ? quotation.received_pdf_path 
      : path.join(process.cwd(), quotation.received_pdf_path);
      
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'PDF file not found on disk' });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
};

const parseReceivedQuotationPDF = async (req, res, next) => {
  try {
    const quotation = await quotationService.getQuotationById(req.params.quotationId);
    if (!quotation.received_pdf_path) {
      return res.status(404).json({ error: 'Received PDF not found' });
    }
    
    const path = require('path');
    const absolutePath = path.isAbsolute(quotation.received_pdf_path) 
      ? quotation.received_pdf_path 
      : path.join(process.cwd(), quotation.received_pdf_path);
      
    const items = await quotationService.parseVendorQuotationPDF(absolutePath);
    res.json(items);
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
  getQuotationPDF,
  uploadVendorResponse,
  parseQuotationPDF,
  getReceivedQuotationPDF,
  parseReceivedQuotationPDF
};
