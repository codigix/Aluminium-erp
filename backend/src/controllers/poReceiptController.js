const poReceiptService = require('../services/poReceiptService');
const generatePoPdf = require('../utils/generatePoPdf');

const createPOReceipt = async (req, res, next) => {
  try {
    const { poId, receiptDate, receivedQuantity, notes } = req.body;
    const result = await poReceiptService.createPOReceipt(
      poId,
      receiptDate,
      receivedQuantity,
      notes
    );
    res.status(201).json({ message: 'PO Receipt created', data: result });
  } catch (error) {
    next(error);
  }
};

const getPOReceipts = async (req, res, next) => {
  try {
    const receipts = await poReceiptService.getPOReceipts(req.query);
    res.json(receipts);
  } catch (error) {
    next(error);
  }
};

const getPOReceiptById = async (req, res, next) => {
  try {
    const receipt = await poReceiptService.getPOReceiptById(req.params.receiptId);
    res.json(receipt);
  } catch (error) {
    next(error);
  }
};

const updatePOReceipt = async (req, res, next) => {
  try {
    const { receiptDate, receivedQuantity, notes, status } = req.body;
    const result = await poReceiptService.updatePOReceipt(
      req.params.receiptId,
      receiptDate,
      receivedQuantity,
      notes,
      status
    );
    res.json({ message: 'PO Receipt updated', data: result });
  } catch (error) {
    next(error);
  }
};

const deletePOReceipt = async (req, res, next) => {
  try {
    await poReceiptService.deletePOReceipt(req.params.receiptId);
    res.json({ message: 'PO Receipt deleted' });
  } catch (error) {
    next(error);
  }
};

const getPOReceiptStats = async (req, res, next) => {
  try {
    const stats = await poReceiptService.getPOReceiptStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

const generatePOReceiptPdf = async (req, res, next) => {
  try {
    const { receiptId } = req.params;
    const receipt = await poReceiptService.getPOReceiptById(receiptId);
    
    let items = [];
    if (receipt.po_id) {
      const purchaseOrderService = require('../services/purchaseOrderService');
      const po = await purchaseOrderService.getPurchaseOrderById(receipt.po_id);
      items = po.items || [];
    }
    
    const pdfPath = await generatePoPdf({
      type: 'receipt',
      receipt,
      items
    });

    res.download(pdfPath, `PO_Receipt_${receipt.po_number}.pdf`, (err) => {
      if (err) {
        console.error('Download error:', err);
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPOReceipt,
  getPOReceipts,
  getPOReceiptById,
  updatePOReceipt,
  deletePOReceipt,
  getPOReceiptStats,
  generatePOReceiptPdf
};
