const grnItemService = require('../services/grnItemService');
const inventoryPostingService = require('../services/inventoryPostingService');
const poBalanceService = require('../services/poBalanceService');
const qcInspectionsService = require('../services/qcInspectionsService');

const createGRNWithItems = async (req, res, next) => {
  try {
    const {
      poId,
      receiptId,
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

    const grn = await grnService.createGRN(po.po_number, grnDate || new Date(), 0, notes, receiptId || null);

    const grnItemResults = [];
    let totalAcceptedQty = 0;
    let totalRejectedQty = 0;
    const pool = require('../config/db');

    for (const item of items) {
      try {
        let poItemId = item.poItemId;

        const [poItemResult] = await pool.query(
          'SELECT id FROM purchase_order_items WHERE item_code = ? AND purchase_order_id = ?',
          [item.itemCode, poId]
        );

        if (poItemResult.length > 0) {
          poItemId = poItemResult[0].id;
        } else {
          console.warn(`Creating missing purchase_order_item for: ${item.itemCode}`);
          const [insertResult] = await pool.execute(
            `INSERT INTO purchase_order_items 
             (purchase_order_id, item_code, description, material_name, material_type, item_group, product_type, drawing_no, quantity, unit, unit_rate, amount) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              poId, 
              item.itemCode, 
              item.description || '', 
              item.materialName || null,
              item.materialType || null,
              item.itemGroup || null,
              item.productType || null,
              item.drawingNo || null,
              item.poQty, 
              'NOS', 
              0, 
              0
            ]
          );
          poItemId = insertResult.insertId;
        }

        const grnItem = await grnItemService.createGRNItem(
          grn.id,
          poItemId,
          item.poQty,
          item.acceptedQty,
          item.remarks
        );

        grnItemResults.push(grnItem);
        totalAcceptedQty += item.acceptedQty || 0;

        await inventoryPostingService.postInventoryFromGRN(
          grn.id,
          poItemId,
          item.acceptedQty || 0,
          0,
          grn.po_number
        );
      } catch (itemError) {
        console.error(`Error creating GRN item for ${item.itemCode}:`, itemError.message);
        grnItemResults.push({
          itemCode: item.itemCode,
          error: itemError.message
        });
      }
    }

    await poBalanceService.updatePOStatus(poId);

    const summary = await grnItemService.getSummaryByGrnId(grn.id);
    const grnItems = await grnItemService.getGRNItemsByGrnId(grn.id);
    const grnStatus = grnItemService.calculateGRNStatus(grnItems);

    await grnService.updateGRN(grn.id, {
      receivedQuantity: summary.total_accepted_qty,
      status: grnStatus
    });

    try {
      const inspectionDate = grnDate || new Date().toISOString().split('T')[0];
      const qcInspection = await qcInspectionsService.createQC(
        grn.id,
        inspectionDate,
        summary.total_accepted_qty || 0,
        0,
        null,
        'Auto-created from GRN'
      );
    } catch (qcError) {
      console.error('QC creation error (non-blocking):', qcError.message);
    }

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

    const pool = require('../config/db');
    const [itemResult] = await pool.query(
      'SELECT grn_id FROM grn_items WHERE id = ?',
      [grnItemId]
    );

    if (!itemResult.length) {
      return res.status(404).json({ error: 'GRN Item not found' });
    }

    const grnId = itemResult[0].grn_id;

    const updated = await grnItemService.updateGRNItem(
      grnItemId,
      {
        receivedQty,
        acceptedQty,
        rejectedQty,
        remarks
      }
    );

    const grnService = require('../services/grnService');
    const grnItems = await grnItemService.getGRNItemsByGrnId(grnId);
    const summary = await grnItemService.getSummaryByGrnId(grnId);
    const grnStatus = grnItemService.calculateGRNStatus(grnItems);

    await grnService.updateGRN(grnId, {
      receivedQuantity: summary.total_accepted_qty,
      status: grnStatus
    });

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

    const pool = require('../config/db');
    const [itemResult] = await pool.query(
      'SELECT grn_id FROM grn_items WHERE id = ?',
      [grnItemId]
    );

    if (!itemResult.length) {
      return res.status(404).json({ error: 'GRN Item not found' });
    }

    const grnId = itemResult[0].grn_id;

    const result = await grnItemService.approveExcessGRNItem(
      grnItemId,
      approvalNotes
    );

    const grnService = require('../services/grnService');
    const grnItems = await grnItemService.getGRNItemsByGrnId(grnId);
    const summary = await grnItemService.getSummaryByGrnId(grnId);
    const grnStatus = grnItemService.calculateGRNStatus(grnItems);

    await grnService.updateGRN(grnId, {
      receivedQuantity: summary.total_accepted_qty,
      status: grnStatus
    });

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

    const pool = require('../config/db');
    const [itemResult] = await pool.query(
      'SELECT grn_id FROM grn_items WHERE id = ?',
      [grnItemId]
    );

    if (!itemResult.length) {
      return res.status(404).json({ error: 'GRN Item not found' });
    }

    const grnId = itemResult[0].grn_id;

    const result = await grnItemService.rejectExcessGRNItem(
      grnItemId,
      rejectionReason
    );

    const grnService = require('../services/grnService');
    const grnItems = await grnItemService.getGRNItemsByGrnId(grnId);
    const summary = await grnItemService.getSummaryByGrnId(grnId);
    const grnStatus = grnItemService.calculateGRNStatus(grnItems);

    await grnService.updateGRN(grnId, {
      receivedQuantity: summary.total_accepted_qty,
      status: grnStatus
    });

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

const deleteGRNItem = async (req, res, next) => {
  try {
    const { grnItemId } = req.params;

    if (!grnItemId) {
      return res.status(400).json({ message: 'GRN Item ID is required' });
    }

    const result = await grnItemService.deleteGRNItem(grnItemId);
    
    res.json({
      success: true,
      message: 'GRN item deleted successfully',
      deletedId: grnItemId
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
  getInventoryLedger,
  deleteGRNItem
};
