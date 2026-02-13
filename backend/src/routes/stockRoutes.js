const express = require('express');
const router = express.Router();
const stockService = require('../services/stockService');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize(['STOCK_VIEW', 'DESIGN_VIEW']), async (req, res) => {
  try {
    const items = await stockService.getStockBalance();
    res.json(items);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/items/next-code', authenticate, authorize(['STOCK_VIEW', 'DESIGN_VIEW', 'DESIGN_MANAGE']), async (req, res) => {
  try {
    const { itemName, itemGroup } = req.query;
    const itemCode = await stockService.generateItemCode(itemName, itemGroup);
    res.json({ itemCode });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.post('/items', authenticate, authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), async (req, res) => {
  try {
    const result = await stockService.createItem(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.put('/items/:id', authenticate, authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), async (req, res) => {
  try {
    const result = await stockService.updateItem(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.delete('/items/:id', authenticate, authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), async (req, res) => {
  try {
    const result = await stockService.deleteStockBalance(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/ledger', authenticate, authorize(['STOCK_VIEW']), async (req, res) => {
  try {
    const { itemCode, startDate, endDate } = req.query;
    const ledger = await stockService.getStockLedger(itemCode, startDate, endDate);
    res.json(ledger);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/balance', authenticate, authorize(['STOCK_VIEW', 'DESIGN_VIEW', 'DESIGN_MANAGE']), async (req, res) => {
  try {
    const { drawingNo } = req.query;
    const balances = await stockService.getStockBalance(drawingNo);
    res.json(balances);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/balance/:itemCode', authenticate, authorize(['STOCK_VIEW', 'DESIGN_VIEW', 'DESIGN_MANAGE']), async (req, res) => {
  try {
    const balance = await stockService.getStockBalanceByItem(req.params.itemCode);
    if (!balance) {
      return res.status(404).json({ message: 'Stock balance not found' });
    }
    res.json(balance);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.post('/ledger/entry', authenticate, authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), async (req, res) => {
  try {
    const { itemCode, transactionType, quantity, refDocType, refDocId, refDocNumber, remarks } = req.body;
    const userId = req.user?.id;

    if (!itemCode || !transactionType || quantity === undefined) {
      return res.status(400).json({ message: 'itemCode, transactionType, and quantity are required' });
    }

    await stockService.addStockLedgerEntry(
      itemCode,
      transactionType,
      quantity,
      refDocType,
      refDocId,
      refDocNumber,
      remarks,
      userId
    );

    const ledger = await stockService.getStockLedger(itemCode);
    res.status(201).json(ledger[0]);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.delete('/ledger/:id', authenticate, authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), async (req, res) => {
  try {
    await stockService.deleteStockLedgerEntry(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.delete('/balance/:id', authenticate, authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), async (req, res) => {
  try {
    await stockService.deleteStockBalance(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

module.exports = router;
