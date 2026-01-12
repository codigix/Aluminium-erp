const express = require('express');
const router = express.Router();
const stockService = require('../services/stockService');
const { authorizeByDepartment } = require('../middleware/authMiddleware');

router.use(authorizeByDepartment([8]));

router.get('/ledger', async (req, res) => {
  try {
    const { itemCode, startDate, endDate } = req.query;
    const ledger = await stockService.getStockLedger(itemCode, startDate, endDate);
    res.json(ledger);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/balance', async (req, res) => {
  try {
    const balances = await stockService.getStockBalance();
    res.json(balances);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/balance/:itemCode', async (req, res) => {
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

router.post('/ledger/entry', async (req, res) => {
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

router.delete('/ledger/:id', async (req, res) => {
  try {
    await stockService.deleteStockLedgerEntry(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.delete('/balance/:id', async (req, res) => {
  try {
    await stockService.deleteStockBalance(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

module.exports = router;
