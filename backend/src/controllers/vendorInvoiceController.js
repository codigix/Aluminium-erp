const vendorInvoiceService = require('../services/vendorInvoiceService');

const getVendorInvoices = async (req, res, next) => {
  try {
    const invoices = await vendorInvoiceService.getVendorInvoices();
    res.json(invoices);
  } catch (error) {
    next(error);
  }
};

const getVendorInvoiceById = async (req, res, next) => {
  try {
    const invoice = await vendorInvoiceService.getVendorInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Vendor Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    next(error);
  }
};

const updateInvoiceDetails = async (req, res, next) => {
  try {
    const id = req.params.id;
    let invoice_pdf_path = null;
    
    if (req.files && req.files.length > 0) {
      invoice_pdf_path = req.files[0].path.replace(/\\/g, '/');
    } else if (req.file) {
      invoice_pdf_path = req.file.path.replace(/\\/g, '/');
    }

    const data = {
      vendor_invoice_no: req.body.vendor_invoice_no || null,
      invoice_date: req.body.invoice_date || null,
      invoice_amount: req.body.invoice_amount || 0.00,
      gst_amount: req.body.gst_amount || 0.00,
      invoice_pdf_path: invoice_pdf_path || req.body.invoice_pdf_path || null
    };

    const invoice = await vendorInvoiceService.updateInvoiceDetails(id, data);
    res.json({
      message: 'Invoice details saved successfully',
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};

const verifyInvoice = async (req, res, next) => {
  try {
    const id = req.params.id;
    const invoice = await vendorInvoiceService.verifyInvoice(id);
    res.json({
      message: 'Vendor Invoice verified successfully.',
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVendorInvoices,
  getVendorInvoiceById,
  updateInvoiceDetails,
  verifyInvoice
};
