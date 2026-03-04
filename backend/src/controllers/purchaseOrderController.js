const purchaseOrderService = require('../services/purchaseOrderService');

const createPurchaseOrder = async (req, res, next) => {
  try {
    const result = await purchaseOrderService.createPurchaseOrder(req.body);
    res.status(201).json({ message: 'Purchase Order created', data: result });
  } catch (error) {
    next(error);
  }
};

const previewPurchaseOrder = async (req, res, next) => {
  try {
    const preview = await purchaseOrderService.previewPurchaseOrder(req.params.quotationId);
    res.json(preview);
  } catch (error) {
    next(error);
  }
};

const getPurchaseOrders = async (req, res, next) => {
  try {
    const pos = await purchaseOrderService.getPurchaseOrders(req.query);
    res.json(pos);
  } catch (error) {
    next(error);
  }
};

const getPurchaseOrderById = async (req, res, next) => {
  try {
    const po = await purchaseOrderService.getPurchaseOrderById(req.params.poId);
    res.json(po);
  } catch (error) {
    next(error);
  }
};

const updatePurchaseOrder = async (req, res, next) => {
  try {
    const result = await purchaseOrderService.updatePurchaseOrder(
      req.params.poId,
      req.body
    );
    res.json({ message: 'Purchase Order updated', data: result });
  } catch (error) {
    next(error);
  }
};

const deletePurchaseOrder = async (req, res, next) => {
  try {
    await purchaseOrderService.deletePurchaseOrder(req.params.poId);
    res.json({ message: 'Purchase Order deleted' });
  } catch (error) {
    next(error);
  }
};

const getPurchaseOrderStats = async (req, res, next) => {
  try {
    const stats = await purchaseOrderService.getPurchaseOrderStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

const getPOMaterialRequests = async (req, res, next) => {
  try {
    const requests = await purchaseOrderService.getPOMaterialRequests(req.query);
    res.json(requests);
  } catch (error) {
    next(error);
  }
};

const handleStoreAcceptance = async (req, res, next) => {
  try {
    const result = await purchaseOrderService.handleStoreAcceptance(req.params.poId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const approvePurchaseOrder = async (req, res, next) => {
  try {
    const result = await purchaseOrderService.approvePurchaseOrder(
      req.params.poId,
      req.user.id
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getPurchaseOrderPDF = async (req, res, next) => {
  try {
    const pdfBuffer = await purchaseOrderService.generatePurchaseOrderPDF(req.params.poId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=PO-${req.params.poId}.pdf`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

const sendPurchaseOrderEmail = async (req, res, next) => {
  try {
    const result = await purchaseOrderService.sendPurchaseOrderEmail(req.params.poId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const uploadInvoice = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const invoiceUrl = `uploads/${req.file.filename}`;
    const result = await purchaseOrderService.updatePurchaseOrderInvoice(req.params.poId, invoiceUrl);
    res.json({ message: 'Invoice uploaded successfully', data: result });
  } catch (error) {
    next(error);
  }
};

const sendToPendingPayment = async (req, res, next) => {
  try {
    const pool = require('../config/db');
    const poId = parseInt(req.params.poId);
    
    console.log(`[DEBUG] sendToPendingPayment called for PO ID: ${poId}`);
    
    const [existing] = await pool.query(
      'SELECT id, po_number, status FROM purchase_orders WHERE id = ?',
      [poId]
    );

    if (!existing.length) {
      const error = new Error('Purchase Order not found');
      error.statusCode = 404;
      throw error;
    }

    console.log(`[DEBUG] Current PO status: ${existing[0].status}`);
    console.log(`[DEBUG] Updating to: PENDING_PAYMENT`);

    // Use query() instead of execute() to avoid mysql2 parameter binding issues
    const [result] = await pool.query(
      'UPDATE purchase_orders SET status = "PENDING_PAYMENT" WHERE id = ?',
      [poId]
    );

    console.log(`[DEBUG] Update successful`);

    res.json({
      message: 'Invoice sent to payment processing',
      data: {
        id: poId,
        poNumber: existing[0].po_number,
        status: 'PENDING_PAYMENT'
      }
    });
  } catch (error) {
    console.error(`[ERROR] sendToPendingPayment error:`, error);
    next(error);
  }
};

module.exports = {
  createPurchaseOrder,
  previewPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderStats,
  getPOMaterialRequests,
  handleStoreAcceptance,
  approvePurchaseOrder,
  getPurchaseOrderPDF,
  sendPurchaseOrderEmail,
  uploadInvoice,
  sendToPendingPayment
};
