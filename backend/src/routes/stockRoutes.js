const express = require('express');
const router = express.Router();
const stockService = require('../services/stockService');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize(['STOCK_VIEW', 'DESIGN_VIEW']), async (req, res) => {
  try {
    const { includeAll } = req.query;
    const items = await stockService.getStockBalance(null, includeAll === 'true');
    res.json(items);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/groups', authenticate, authorize(['STOCK_VIEW', 'DESIGN_VIEW', 'PROD_VIEW']), async (req, res) => {
  try {
    const itemGroupService = require('../services/itemGroupService');
    const groups = await itemGroupService.getAll();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    const { drawingNo, includeAll } = req.query;
    const balances = await stockService.getStockBalance(drawingNo, includeAll === 'true');
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

    // Resolve weight and dimensions from stock_balance to ensure manual entries update weight
    const [balanceRows] = await pool.query(
      `SELECT unit, weight_per_unit, length, width, thickness, diameter, outer_diameter, density, shape_id, shape_type, material_name, material_type 
       FROM stock_balance WHERE item_code = ? LIMIT 1`,
      [itemCode]
    );

    let weight = 0;
    let extraOptions = {};
    if (balanceRows.length > 0) {
      const b = balanceRows[0];
      const weightPerUnit = parseFloat(b.weight_per_unit || 0);
      const isKg = (b.unit || '').toLowerCase() === 'kg' || (b.unit || '').toLowerCase() === 'kgs' || (b.unit || '').toLowerCase() === 'kilogram';
      
      if (weightPerUnit > 0) {
        weight = weightPerUnit * Math.abs(parseFloat(quantity || 0));
      } else if (isKg) {
        weight = Math.abs(parseFloat(quantity || 0));
      }
      
      extraOptions = {
        weight: weight,
        unit: b.unit,
        length: b.length,
        width: b.width,
        thickness: b.thickness,
        diameter: b.diameter,
        outer_diameter: b.outer_diameter,
        density: b.density,
        weight_per_unit: b.weight_per_unit,
        shape_id: b.shape_id,
        shape_type: b.shape_type,
        materialName: b.material_name,
        materialType: b.material_type
      };
    }

    await stockService.addStockLedgerEntry(
      itemCode,
      transactionType,
      quantity,
      refDocType,
      refDocId,
      refDocNumber,
      remarks,
      userId,
      extraOptions
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
