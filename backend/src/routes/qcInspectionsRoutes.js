const express = require('express');
const router = express.Router();
const qcService = require('../services/qcInspectionsService');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const stockEntryService = require('../services/stockEntryService');
const stockService = require('../services/stockService');
const pool = require('../config/db');

router.get('/stats', authenticate, authorize(['QC_VIEW']), async (req, res) => {
  try {
    const stats = await qcService.getQCStats();
    res.json(stats);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/reports', authenticate, authorize(['QC_VIEW']), async (req, res) => {
  try {
    const reports = await qcService.getQCReports(req.query);
    res.json(reports);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/', authenticate, authorize(['QC_VIEW']), async (req, res) => {
  try {
    const qcs = await qcService.getAllQCs();
    res.json(qcs);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/rejections', authenticate, authorize(['QC_VIEW']), async (req, res) => {
  try {
    const items = await qcService.getRejectedItems();
    res.json(items);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/:qcId', authenticate, authorize(['QC_VIEW']), async (req, res) => {
  try {
    const qc = await qcService.getQCWithDetails(req.params.qcId);
    if (!qc) {
      return res.status(404).json({ message: 'QC Inspection not found' });
    }
    
    const items = await qcService.getQCItems(req.params.qcId);
    res.json({ ...qc, items });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/:qcId/items', authenticate, authorize(['QC_VIEW']), async (req, res) => {
  try {
    const items = await qcService.getQCItems(req.params.qcId);
    res.json(items);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.patch('/items/:qcItemId', authenticate, authorize(['QC_EDIT']), async (req, res) => {
  try {
    const item = await qcService.updateQCItem(req.params.qcItemId, req.body);
    res.json(item);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.post('/', authenticate, authorize(['QC_CREATE']), async (req, res) => {
  try {
    const { grnId, inspectionDate, passQuantity, failQuantity, defects, remarks } = req.body;
    const qcId = await qcService.createQC(grnId, inspectionDate, passQuantity, failQuantity, defects, remarks);
    const qc = await qcService.getQCWithDetails(qcId);
    res.status(201).json(qc);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.patch('/:qcId', authenticate, authorize(['QC_EDIT']), async (req, res) => {
  try {
    const qc = await qcService.updateQC(req.params.qcId, req.body);
    res.json(qc);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.delete('/:qcId', authenticate, authorize(['QC_EDIT']), async (req, res) => {
  try {
    const result = await qcService.deleteQC(req.params.qcId);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.post('/:qcId/send-email', authenticate, authorize(['QC_EDIT']), async (req, res) => {
  try {
    const result = await qcService.sendQCAlertEmail(req.params.qcId, req.body);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.post('/:qcId/invoice', authenticate, authorize(['QC_EDIT']), upload.single('invoice'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const invoiceUrl = `uploads/${req.file.filename}`;
    const result = await qcService.updateQCInvoice(req.params.qcId, invoiceUrl);
    res.json({ message: 'Invoice uploaded successfully', data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.post('/:qcId/attachments', authenticate, authorize(['QC_EDIT']), upload.array('attachments', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
    const attachments = req.files.map(file => ({
      file_name: file.originalname,
      file_url: `uploads/${file.filename}`
    }));
    const result = await qcService.addQCAttachments(req.params.qcId, attachments);
    res.json({ message: 'Attachments uploaded successfully', data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/:qcId/attachments', authenticate, authorize(['QC_VIEW']), async (req, res) => {
  try {
    const attachments = await qcService.getQCAttachments(req.params.qcId);
    res.json(attachments);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.delete('/attachments/:attachmentId', authenticate, authorize(['QC_EDIT']), async (req, res) => {
  try {
    const result = await qcService.deleteQCAttachment(req.params.attachmentId);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.post('/:qcId/stock-entry', authenticate, authorize(['QC_EDIT']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const qc = await qcService.getQCWithDetails(req.params.qcId);
    if (!qc) return res.status(404).json({ message: 'QC Inspection not found' });
    if (qc.stock_entry_no) {
      return res.status(400).json({ message: `Stock Entry already exists (${qc.stock_entry_no})` });
    }

    await connection.beginTransaction();

    // Fetch GRN items with actual dimensions from grn_items (NOT poi) and qc_inspection_items item_code
    const [grnItems] = await connection.query(
      `SELECT gi.id as grn_item_id,
              COALESCE(gi.received_qty, gi.accepted_qty, 0) as qty,
              COALESCE(qci.item_code, poi.item_code) as resolved_item_code,
              COALESCE(poi.material_name, gi.uom) as material_name,
              poi.material_type,
              gi.uom as uom,
              poi.unit_rate as valuation_rate,
              NULL as shape_id,
              poi.shape_type as shape_type,
              COALESCE(gi.density, poi.density, 0) as density,
              COALESCE(gi.weight_per_unit, poi.weight_per_unit, 0) as weight_per_unit,
              COALESCE(NULLIF(gi.length,0), NULLIF(poi.length,0), 0) as length,
              COALESCE(NULLIF(gi.width,0), NULLIF(poi.width,0), 0) as width,
              COALESCE(NULLIF(gi.thickness,0), NULLIF(poi.thickness,0), 0) as thickness,
              COALESCE(NULLIF(gi.diameter,0), NULLIF(poi.diameter,0), 0) as diameter,
              COALESCE(NULLIF(gi.outer_diameter,0), NULLIF(poi.outer_diameter,0), 0) as outer_diameter
       FROM grn_items gi
       LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
       LEFT JOIN qc_inspection_items qci ON qci.grn_item_id = gi.id AND qci.qc_inspection_id = ?
       WHERE gi.grn_id = ?`,
      [qc.id, qc.grn_id]
    );

    if (!grnItems.length) {
      await connection.rollback();
      connection.release();
      return res.json({ success: false, message: 'No GRN items found' });
    }

    console.log(`[QC Stock-Entry] Found ${grnItems.length} items to process for GRN ID: ${qc.grn_id}`);

    let totalPosted = 0;
    const itemsToInsert = [];

    for (const item of grnItems) {
      const qty = parseFloat(item.qty) || 0;
      if (qty <= 0) continue;

      // Resolve item_code using actual GRN dimensions
      let itemCode = item.resolved_item_code || null;
      if (!itemCode && item.material_name) {
        // Find existing stock_balance record using actual dimensions from GRN item
        const [sbRows] = await connection.query(
          `SELECT item_code FROM stock_balance
           WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?))
           AND (ABS(COALESCE(length,0) - ?) < 0.01)
           AND (ABS(COALESCE(width,0) - ?) < 0.01)
           AND (ABS(COALESCE(thickness,0) - ?) < 0.01)
           AND (ABS(COALESCE(diameter,0) - ?) < 0.01)
           LIMIT 1`,
          [item.material_name, item.length, item.width, item.thickness, item.diameter]
        );
        itemCode = sbRows.length ? sbRows[0].item_code : null;
      }
      if (!itemCode) {
        console.warn(`[QC Stock-Entry] Skipping item without resolved item code: Material = ${item.material_name}`);
        continue;
      }

      const weightPerUnit = parseFloat(item.weight_per_unit || 0);
      const isKg = (item.uom || '').toLowerCase() === 'kg' || (item.uom || '').toLowerCase() === 'kgs' || (item.uom || '').toLowerCase() === 'kilogram';
      let passWeight = 0;
      if (weightPerUnit > 0) {
        passWeight = weightPerUnit * qty;
      } else if (isKg) {
        passWeight = qty;
      }

      // Use the same createQCStockLedgerEntry that Final QC uses
      await stockService.createQCStockLedgerEntry(
        qc.id,
        qc.grn_id,
        item.grn_item_id,
        itemCode,
        qty,
        connection,
        passWeight
      );

      itemsToInsert.push({
        grn_item_id: item.grn_item_id,
        item_code: itemCode,
        material_name: item.material_name,
        material_type: item.material_type || 'RAW_MATERIAL',
        quantity: qty,
        uom: item.uom || 'Nos',
        valuation_rate: parseFloat(item.valuation_rate) || 0,
        length: item.length || null,
        width: item.width || null,
        thickness: item.thickness || null,
        diameter: item.diameter || null,
        outer_diameter: item.outer_diameter || null,
        density: item.density || null,
        weight_per_unit: item.weight_per_unit || null,
        shape_id: item.shape_id || null,
        shape_type: item.shape_type || null
      });

      totalPosted++;
    }

    if (totalPosted === 0) {
      await connection.rollback();
      connection.release();
      return res.json({ success: false, message: 'No items with positive receiving weight / matching item code found' });
    }

    // Insert a stock_entries record linked to this GRN so "stock_entry_no" computed field shows correctly
    const entryNo = `SE-PARTIAL-GRN${String(qc.grn_id).padStart(4, '0')}`;
    const [existingEntry] = await connection.query(
      'SELECT id FROM stock_entries WHERE grn_id = ? LIMIT 1',
      [qc.grn_id]
    );

    let stockEntryId;
    if (!existingEntry.length) {
      // Resolve toWarehouseId
      const [whRows] = await connection.query("SELECT id FROM warehouses WHERE warehouse_code = 'RM-HOLD' LIMIT 1");
      const toWarehouseId = whRows.length ? whRows[0].id : null;

      const [insertResult] = await connection.execute(
        `INSERT INTO stock_entries (entry_no, entry_type, purpose, grn_id, entry_date, remarks, created_by, status, to_warehouse_id)
         VALUES (?, 'Material Receipt', 'Partial QC Stock Release', ?, CURDATE(), 'Auto-created from Partially QC', ?, 'submitted', ?)`,
        [entryNo, qc.grn_id, req.user.id, toWarehouseId]
      );
      stockEntryId = insertResult.insertId;

      if (itemsToInsert.length === 0) {
        throw new Error('No valid stock entry items found to insert into stock_entry_items.');
      }

      for (const entryItem of itemsToInsert) {
        const amount = entryItem.quantity * entryItem.valuation_rate;
        console.log(`[QC Stock-Entry] Inserting Stock Entry Item: StockEntryID = ${stockEntryId}, GRNItemID = ${entryItem.grn_item_id}, ItemCode = ${entryItem.item_code}, Qty = ${entryItem.quantity}, UOM = ${entryItem.uom}, Warehouse = RM-HOLD`);
        
        await connection.execute(
          `INSERT INTO stock_entry_items 
           (stock_entry_id, item_code, material_name, material_type, quantity, uom, valuation_rate, amount,
            length, width, thickness, diameter, outer_diameter, density, weight_per_unit, shape_id, shape_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            stockEntryId,
            entryItem.item_code,
            entryItem.material_name,
            entryItem.material_type,
            entryItem.quantity,
            entryItem.uom,
            entryItem.valuation_rate,
            amount,
            entryItem.length,
            entryItem.width,
            entryItem.thickness,
            entryItem.diameter,
            entryItem.outer_diameter,
            entryItem.density,
            entryItem.weight_per_unit,
            entryItem.shape_id,
            entryItem.shape_type
          ]
        );
      }
      console.log(`[QC Stock-Entry] Successfully auto-created Stock Entry ${entryNo} with ${itemsToInsert.length} items.`);
    } else {
      stockEntryId = existingEntry[0].id;
      console.log(`[QC Stock-Entry] Stock Entry already exists for GRN ${qc.grn_id} (ID: ${stockEntryId}).`);
    }

    await connection.commit();
    connection.release();
    return res.json({ success: true, entryNo, message: `Stock released for ${totalPosted} item(s)` });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    connection.release();
    console.error(`[QC Stock-Entry] ERROR:`, error.message);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});


router.post('/:qcId/create-shipment', authenticate, authorize(['QC_EDIT']), async (req, res) => {
  try {
    const result = await qcService.createShipmentFromQC(req.params.qcId);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/:qcId/pdf', authenticate, authorize(['QC_VIEW']), async (req, res) => {
  try {
    const pdfPath = await qcService.generateQcPdf(req.params.qcId);
    res.download(pdfPath, `QC_Report_${req.params.qcId}.pdf`, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

module.exports = router;
