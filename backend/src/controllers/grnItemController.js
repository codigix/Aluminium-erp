const grnItemService = require('../services/grnItemService');
const inventoryPostingService = require('../services/inventoryPostingService');
const poBalanceService = require('../services/poBalanceService');

const createGRNWithItems = async (req, res, next) => {
  try {
    const {
      poId,
      grnDate,
      items, // [{ poItemId, receivedQty, acceptedQty, rejectedQty, remarks }, ...]
      notes
    } = req.body;

    if (!poId || !items || items.length === 0) {
      return res.status(400).json({
        error: 'PO ID and items array are required'
      });
    }

    const grnService = require('../services/grnService');
    const poService = require('../services/purchaseOrderService');

    const po = await poService.getPurchaseOrderById(poId);
    if (!po) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }

    const grn = await grnService.createGRN(po.po_number, grnDate || new Date(), 0, notes);

    const grnItemResults = [];
    let totalAcceptedQty = 0;
    let totalRejectedQty = 0;

    for (const item of items) {
      try {
        const grnItem = await grnItemService.createGRNItem(
          grn.id,
          item.poItemId,
          item.poQty,
          item.acceptedQty,
          item.remarks
        );

        grnItemResults.push(grnItem);
        totalAcceptedQty += item.acceptedQty || 0;

        await inventoryPostingService.postInventoryFromGRN(
          grn.id,
          item.poItemId,
          item.acceptedQty || 0,
          0,
          grn.po_number
        );
      } catch (itemError) {
        grnItemResults.push({
          poItemId: item.poItemId,
          error: itemError.message
        });
      }
    }

    await poBalanceService.updatePOStatus(poId);

    const summary = await grnItemService.getSummaryByGrnId(grn.id);
    const grnItems = await grnItemService.getGRNItemsByGrnId(grn.id);
    const grnStatus = grnItemService.calculateGRNStatus(grnItems);

    res.status(201).json({
      grn_id: grn.id,
      po_number: grn.po_number,
      grn_date: grn.grn_date,
      status: grnStatus,
      items: grnItemResults,
      summary,
      message: 'GRN created successfully with item-wise processing'
    });
  } catch (error) {
    next(error);
  }
};

const getGRNItemDetails = async (req, res, next) => {
  try {
    const { grnId } = req.params;

    const items = await grnItemService.getGRNItemsByGrnId(grnId);
    const summary = await grnItemService.getSummaryByGrnId(grnId);

    res.json({
      grn_id: grnId,
      items,
      summary
    });
  } catch (error) {
    next(error);
  }
};

const updateGRNItem = async (req, res, next) => {
  try {
    const { grnItemId } = req.params;
    const {
      receivedQty,
      acceptedQty,
      rejectedQty,
      remarks
    } = req.body;

    const updated = await grnItemService.updateGRNItem(
      grnItemId,
      {
        receivedQty,
        acceptedQty,
        rejectedQty,
        remarks
      }
    );

    res.json({
      message: 'GRN item updated successfully',
      grn_item: updated
    });
  } catch (error) {
    next(error);
  }
};

const approveExcessQuantity = async (req, res, next) => {
  try {
    const { grnItemId } = req.params;
    const { approvalNotes } = req.body;

    const result = await grnItemService.approveExcessGRNItem(
      grnItemId,
      approvalNotes
    );

    res.json({
      message: 'Excess quantity approved',
      approval_result: result
    });
  } catch (error) {
    next(error);
  }
};

const rejectExcessQuantity = async (req, res, next) => {
  try {
    const { grnItemId } = req.params;
    const { rejectionReason } = req.body;

    const result = await grnItemService.rejectExcessGRNItem(
      grnItemId,
      rejectionReason
    );

    res.json({
      message: 'Excess quantity rejected',
      rejection_result: result
    });
  } catch (error) {
    next(error);
  }
};

const getPOBalance = async (req, res, next) => {
  try {
    const { poId } = req.params;

    const balance = await poBalanceService.calculatePOBalance(poId);

    res.json({
      po_id: poId,
      balance_info: balance
    });
  } catch (error) {
    next(error);
  }
};

const getItemBalance = async (req, res, next) => {
  try {
    const { poItemId } = req.params;

    const balance = await poBalanceService.calculateItemBalance(poItemId);

    if (!balance) {
      return res.status(404).json({ error: 'PO Item not found' });
    }

    res.json({
      po_item_id: poItemId,
      balance_info: balance
    });
  } catch (error) {
    next(error);
  }
};

const getPOReceiptHistory = async (req, res, next) => {
  try {
    const { poId } = req.params;
    const { poItemId } = req.query;

    const history = await poBalanceService.getPOReceiptHistory(poId, poItemId);

    res.json({
      po_id: poId,
      receipt_history: history
    });
  } catch (error) {
    next(error);
  }
};

const getGRNSummary = async (req, res, next) => {
  try {
    const { grnId } = req.params;

    const summary = await grnItemService.getSummaryByGrnId(grnId);

    res.json({
      grn_id: grnId,
      summary
    });
  } catch (error) {
    next(error);
  }
};

const validateGRNInput = async (req, res, next) => {
  try {
    const { poQty, receivedQty, acceptedQty, rejectedQty } = req.body;

    try {
      grnItemService.validateGRNItemInput(poQty, receivedQty, acceptedQty, rejectedQty);
      const status = grnItemService.determineGRNItemStatus(poQty, receivedQty, acceptedQty, rejectedQty);

      res.json({
        valid: true,
        determined_status: status,
        message: 'Input validation passed'
      });
    } catch (validationError) {
      res.status(400).json({
        valid: false,
        error: validationError.message,
        details: validationError.details || []
      });
    }
  } catch (error) {
    next(error);
  }
};

const getInventoryLedger = async (req, res, next) => {
  try {
    const { grnId } = req.params;

    const items = await grnItemService.getGRNItemsByGrnId(grnId);

    if (!items.length) {
      return res.status(404).json({ error: 'No items found for this GRN' });
    }

    const ledgers = [];

    for (const item of items) {
      const inventory = await inventoryPostingService.getInventoryItem(item.item_code);
      if (inventory) {
        const ledger = await inventoryPostingService.getInventoryLedger(inventory.id, 50);
        ledgers.push({
          item_code: item.item_code,
          item_description: item.description,
          current_stock: inventory.stock_on_hand,
          postings: ledger
        });
      }
    }

    res.json({
      grn_id: grnId,
      inventory_ledgers: ledgers
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGRNWithItems,
  getGRNItemDetails,
  updateGRNItem,
  approveExcessQuantity,
  rejectExcessQuantity,
  getPOBalance,
  getItemBalance,
  getPOReceiptHistory,
  getGRNSummary,
  validateGRNInput,
  getInventoryLedger
};
