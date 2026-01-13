const fs = require('fs');
const parsePoPdf = require('../utils/poParser');
const parseExcelPo = require('../utils/excelPoParser');
const customerPoService = require('../services/customerPoService');

const deriveCreditDays = value => {
  const match = (value || '').match(/(\d+)/);
  return match ? match[1] : '';
};

const createCustomerPo = async (req, res, next) => {
  try {
    const fileBuffer = req.file ? fs.readFileSync(req.file.path) : null;
    const pdfInsights = await parsePoPdf(fileBuffer);

    const parseItems = value => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      try {
        return JSON.parse(value);
      } catch (error) {
        return [];
      }
    };

    if (!req.body.companyId) {
      return res.status(400).json({ message: 'Company is required' });
    }

    const parsedItems = parseItems(req.body.items);
    const fallbackItems = Array.isArray(pdfInsights.items) ? pdfInsights.items : [];
    const rawItems = parsedItems.length ? parsedItems : fallbackItems;
    const sanitizedItems = rawItems
      .map((item, index) => ({
        drawingNo: item.drawingNo || item.itemCode || item.code || `DRW-${index + 1}`,
        itemCode: item.itemCode || item.drawingNo || item.code || `ITEM-${index + 1}`,
        description: item.description || `Line Item ${index + 1}`,
        hsnCode: item.hsnCode || item.hsn || null,
        quantity: Number(item.quantity) || 0,
        unit: item.unit || 'NOS',
        rate: Number(item.rate) || 0,
        cgstPercent: Number(item.cgstPercent || item.cgst || 0),
        sgstPercent: Number(item.sgstPercent || item.sgst || 0),
        igstPercent: Number(item.igstPercent || item.igst || 0),
        deliveryDate: item.deliveryDate || null,
        revisionNo: item.revisionNo || null,
        purchaseReqNo: item.purchaseReqNo || null,
        customerReference: item.customerReference || null,
        discount: Number(item.discount) || 0
      }))
      .filter(item => item.description);

    if (!sanitizedItems.length) {
      return res.status(400).json({ message: 'At least one line item is required' });
    }

    const paymentTerms = req.body.paymentTerms || pdfInsights.paymentTerms || '';

    const payload = {
      companyId: req.body.companyId,
      header: {
        poNumber: req.body.poNumber || pdfInsights.poNumber,
        poDate: req.body.poDate || pdfInsights.poDate,
        poVersion: req.body.poVersion || pdfInsights.poVersion || '1.0',
        orderType: req.body.orderType || pdfInsights.orderType || 'STANDARD',
        plant: req.body.plant || pdfInsights.plant || null,
        currency: req.body.currency || pdfInsights.currency || 'INR',
        paymentTerms,
        creditDays: req.body.creditDays || pdfInsights.creditDays || deriveCreditDays(paymentTerms),
        freightTerms: req.body.freightTerms || pdfInsights.freightTerms || null,
        packingForwarding: req.body.packingForwarding || pdfInsights.packingForwarding || null,
        insuranceTerms: req.body.insuranceTerms || pdfInsights.insuranceTerms || null,
        deliveryTerms: req.body.deliveryTerms || pdfInsights.deliveryTerms || null
      },
      items: sanitizedItems,
      pdfFile: req.file ? req.file.path : null,
      remarks: req.body.remarks || pdfInsights.remarks || null,
      termsAndConditions: req.body.termsAndConditions,
      specialNotes: req.body.specialNotes,
      inspectionClause: req.body.inspectionClause,
      testCertificate: req.body.testCertificate,
      projectName: req.body.projectName,
      drawingRequired: req.body.drawingRequired === 'true' || req.body.drawingRequired === true,
      productionPriority: req.body.productionPriority,
      targetDispatchDate: req.body.targetDispatchDate
    };

    const result = await customerPoService.createCustomerPo(payload);
    res.status(201).json({ message: 'Customer PO captured', data: result, pdfInsights });
  } catch (error) {
    next(error);
  }
};

const parseCustomerPoPdf = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Upload a Customer PO PDF or Excel file' });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const fileName = req.file.originalname || '';
    const fileExt = fileName.split('.').pop().toLowerCase();
    
    console.log(`[PO Parser] Processing file: ${fileName} (${fileExt})`);
    
    let insights = {};
    
    try {
      if (['xls', 'xlsx'].includes(fileExt)) {
        console.log('[PO Parser] Using Excel parser');
        insights = await parseExcelPo(fileBuffer);
      } else {
        console.log('[PO Parser] Using PDF parser');
        insights = await parsePoPdf(fileBuffer);
      }
    } catch (parseError) {
      console.error('[PO Parser] Parse error:', parseError);
      insights = { header: {}, items: [] };
    }
    
    fs.unlink(req.file.path, () => {});

    console.log('[PO Parser] Parsed insights:', JSON.stringify(insights, null, 2));

    const header = {
      companyCode: insights.companyCode || '',
      companyName: insights.companyName || '',
      customerGstin: insights.customerGstin || '',
      billingAddress: insights.billingAddress || '',
      poNumber: insights.poNumber || '',
      poDate: insights.poDate || '',
      paymentTerms: insights.paymentTerms || '',
      creditDays: insights.creditDays || deriveCreditDays(insights.paymentTerms),
      freightTerms: insights.freightTerms || '',
      packingForwarding: insights.packingForwarding || '',
      insuranceTerms: insights.insuranceTerms || '',
      currency: insights.currency || 'INR',
      deliveryTerms: insights.deliveryTerms || '',
      remarks: insights.remarks || '',
      plant: insights.plant || '',
      orderType: insights.orderType || ''
    };

    res.json({
      header,
      items: Array.isArray(insights.items) ? insights.items : []
    });
  } catch (error) {
    console.error('[PO Parser] Unexpected error:', error);
    next(error);
  }
};

const listCustomerPos = async (req, res, next) => {
  try {
    const rows = await customerPoService.listCustomerPos();
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

const getCustomerPo = async (req, res, next) => {
  try {
    const data = await customerPoService.getCustomerPoById(req.params.id);
    if (!data) {
      return res.status(404).json({ message: 'Customer PO not found' });
    }
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const updateCustomerPo = async (req, res, next) => {
  try {
    const parseItems = value => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      try { return JSON.parse(value); } catch (e) { return []; }
    };

    const parsedItems = parseItems(req.body.items);
    const sanitizedItems = parsedItems.map((item, index) => ({
      drawingNo: item.drawingNo || item.itemCode || `DRW-${index + 1}`,
      itemCode: item.itemCode || item.drawingNo || `ITEM-${index + 1}`,
      description: item.description || `Line Item ${index + 1}`,
      hsnCode: item.hsnCode || null,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || 'NOS',
      rate: Number(item.rate) || 0,
      cgstPercent: Number(item.cgstPercent || 0),
      sgstPercent: Number(item.sgstPercent || 0),
      igstPercent: Number(item.igstPercent || 0),
      deliveryDate: item.deliveryDate || null,
      revisionNo: item.revisionNo || null,
      purchaseReqNo: item.purchaseReqNo || null,
      customerReference: item.customerReference || null,
      discount: Number(item.discount) || 0
    }));

    const payload = {
      header: {
        poNumber: req.body.poNumber,
        poDate: req.body.poDate,
        poVersion: req.body.poVersion || '1.0',
        orderType: req.body.orderType || 'STANDARD',
        plant: req.body.plant || null,
        currency: req.body.currency || 'INR',
        paymentTerms: req.body.paymentTerms,
        creditDays: req.body.creditDays,
        freightTerms: req.body.freightTerms || null,
        packingForwarding: req.body.packingForwarding || null,
        insuranceTerms: req.body.insuranceTerms || null,
        deliveryTerms: req.body.deliveryTerms || null
      },
      items: sanitizedItems,
      remarks: req.body.remarks || null,
      termsAndConditions: req.body.termsAndConditions,
      specialNotes: req.body.specialNotes,
      inspectionClause: req.body.inspectionClause,
      testCertificate: req.body.testCertificate
    };

    const result = await customerPoService.updateCustomerPo(req.params.id, payload);
    res.json({ message: 'Customer PO updated', data: result });
  } catch (error) {
    next(error);
  }
};

const deleteCustomerPo = async (req, res, next) => {
  try {
    const success = await customerPoService.deleteCustomerPo(req.params.id);
    if (!success) {
      return res.status(404).json({ message: 'Customer PO not found' });
    }
    res.json({ message: 'Customer PO deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCustomerPo,
  parseCustomerPoPdf,
  listCustomerPos,
  getCustomerPo,
  updateCustomerPo,
  deleteCustomerPo
};
