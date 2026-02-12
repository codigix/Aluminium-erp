const pool = require('../config/db');
const stockService = require('./stockService');

const getAllStockEntries = async (filters = {}) => {
  let query = `
    SELECT se.*, 
           fw.warehouse_name as from_warehouse_name,
           tw.warehouse_name as to_warehouse_name,
           u.username as creator_name
    FROM stock_entries se
    LEFT JOIN warehouses fw ON se.from_warehouse_id = fw.id
    LEFT JOIN warehouses tw ON se.to_warehouse_id = tw.id
    LEFT JOIN users u ON se.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.type) {
    query += ' AND se.entry_type = ?';
    params.push(filters.type);
  }
  if (filters.status) {
    query += ' AND se.status = ?';
    params.push(filters.status);
  }
  if (filters.warehouseId) {
    query += ' AND (se.from_warehouse_id = ? OR se.to_warehouse_id = ?)';
    params.push(filters.warehouseId, filters.warehouseId);
  }

  query += ' ORDER BY se.entry_date DESC, se.created_at DESC';

  const [rows] = await pool.query(query, params);
  
  // Get item counts and total value for each entry
  for (const row of rows) {
    const [stats] = await pool.query(
      'SELECT COUNT(*) as count, SUM(amount) as total_value FROM stock_entry_items WHERE stock_entry_id = ?', 
      [row.id]
    );
    row.item_count = stats[0].count || 0;
    row.total_value = stats[0].total_value || 0;
  }

  return rows;
};

const getStockEntryById = async (id) => {
  const [rows] = await pool.query(
    `SELECT se.*, 
            fw.warehouse_name as from_warehouse_name,
            tw.warehouse_name as to_warehouse_name,
            u.username as creator_name
     FROM stock_entries se
     LEFT JOIN warehouses fw ON se.from_warehouse_id = fw.id
     LEFT JOIN warehouses tw ON se.to_warehouse_id = tw.id
     LEFT JOIN users u ON se.created_by = u.id
     WHERE se.id = ?`,
    [id]
  );

  if (rows.length === 0) return null;

  const [items] = await pool.query('SELECT * FROM stock_entry_items WHERE stock_entry_id = ?', [id]);
  
  return { ...rows[0], items };
};

const generateEntryNo = async (type) => {
  const prefix = 'MA'; // As shown in screenshot
  
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', ''); // YYYYMM
  const fullPrefix = `${prefix}-${dateStr}-`;
  
  const [rows] = await pool.query(
    'SELECT entry_no FROM stock_entries WHERE entry_no LIKE ? ORDER BY entry_no DESC LIMIT 1',
    [`${fullPrefix}%`]
  );

  let nextNum = 1;
  if (rows.length > 0) {
    const lastNum = parseInt(rows[0].entry_no.split('-').pop());
    nextNum = lastNum + 1;
  }

  return `${fullPrefix}${nextNum.toString().padStart(6, '0')}`;
};

const createStockEntry = async (data, userId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const entryNo = await generateEntryNo(data.entryType);

    const [result] = await connection.execute(
      `INSERT INTO stock_entries 
       (entry_no, entry_type, purpose, from_warehouse_id, to_warehouse_id, entry_date, grn_id, remarks, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entryNo,
        data.entryType,
        data.purpose || null,
        data.fromWarehouseId || null,
        data.toWarehouseId || null,
        data.entryDate || new Date(),
        data.grnId || null,
        data.remarks || null,
        userId,
        data.status || 'draft'
      ]
    );

    const entryId = result.insertId;

    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        await connection.execute(
          `INSERT INTO stock_entry_items 
           (stock_entry_id, item_code, quantity, uom, batch_no, valuation_rate, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            entryId,
            item.itemCode,
            item.quantity,
            item.uom || null,
            item.batchNo || null,
            item.valuationRate || 0,
            (item.quantity * (item.valuationRate || 0))
          ]
        );
      }
    }

    if (data.status === 'submitted') {
      await processStockMovement(entryId, connection, userId);
    }

    await connection.commit();
    return { id: entryId, entryNo };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const submitStockEntry = async (id, userId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [entries] = await connection.query('SELECT * FROM stock_entries WHERE id = ?', [id]);
    if (entries.length === 0) throw new Error('Stock Entry not found');
    const entry = entries[0];

    if (entry.status !== 'draft') throw new Error('Only draft entries can be submitted');

    await processStockMovement(id, connection, userId);

    await connection.execute('UPDATE stock_entries SET status = "submitted" WHERE id = ?', [id]);

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const processStockMovement = async (entryId, connection, userId) => {
  console.log(`[StockMovement] Processing movement for entry: ${entryId}`);
  const [entries] = await connection.query('SELECT * FROM stock_entries WHERE id = ?', [entryId]);
  if (entries.length === 0) {
    console.error(`[StockMovement] Entry ${entryId} not found`);
    throw new Error('Stock Entry not found');
  }
  const entry = entries[0];
  const [items] = await connection.query('SELECT * FROM stock_entry_items WHERE stock_entry_id = ?', [entryId]);
  console.log(`[StockMovement] Found ${items.length} items to process`);

  const [fromWh] = entry.from_warehouse_id ? await connection.query('SELECT warehouse_name FROM warehouses WHERE id = ?', [entry.from_warehouse_id]) : [[]];
  const [toWh] = entry.to_warehouse_id ? await connection.query('SELECT warehouse_name FROM warehouses WHERE id = ?', [entry.to_warehouse_id]) : [[]];

  const fromWarehouseName = fromWh[0]?.warehouse_name;
  const toWarehouseName = toWh[0]?.warehouse_name;
  console.log(`[StockMovement] From: ${fromWarehouseName}, To: ${toWarehouseName}`);

  for (const item of items) {
    console.log(`[StockMovement] Item: ${item.item_code}, Qty: ${item.quantity}, Type: ${entry.entry_type}`);
    if (entry.entry_type === 'Material Receipt') {
      await stockService.addStockLedgerEntry(
        item.item_code,
        'IN',
        item.quantity,
        'STOCK_ENTRY',
        entry.id,
        entry.entry_no,
        `Receipt into ${toWarehouseName || 'Warehouse'}. ${entry.remarks || ''}`,
        userId,
        { connection, warehouse: toWarehouseName, valuationRate: item.valuation_rate }
      );
    } else if (entry.entry_type === 'Material Issue') {
      await stockService.addStockLedgerEntry(
        item.item_code,
        'OUT',
        item.quantity,
        'STOCK_ENTRY',
        entry.id,
        entry.entry_no,
        `Issue from ${fromWarehouseName || 'Warehouse'}. ${entry.remarks || ''}`,
        userId,
        { warehouse: fromWarehouseName, valuationRate: item.valuation_rate }
      );
    } else if (entry.entry_type === 'Material Transfer') {
      // OUT from source
      await stockService.addStockLedgerEntry(
        item.item_code,
        'OUT',
        item.quantity,
        'STOCK_ENTRY',
        entry.id,
        entry.entry_no,
        `Transfer from ${fromWarehouseName} to ${toWarehouseName}`,
        userId,
        { warehouse: fromWarehouseName, valuationRate: item.valuation_rate }
      );
      // IN to destination
      await stockService.addStockLedgerEntry(
        item.item_code,
        'IN',
        item.quantity,
        'STOCK_ENTRY',
        entry.id,
        entry.entry_no,
        `Transfer from ${fromWarehouseName} to ${toWarehouseName}`,
        userId,
        { warehouse: toWarehouseName, valuationRate: item.valuation_rate }
      );
    } else if (entry.entry_type === 'Material Adjustment') {
      const type = item.quantity >= 0 ? 'IN' : 'OUT';
      await stockService.addStockLedgerEntry(
        item.item_code,
        type === 'IN' ? 'ADJUSTMENT' : 'OUT',
        Math.abs(item.quantity),
        'STOCK_ENTRY',
        entry.id,
        entry.entry_no,
        `Adjustment in ${fromWarehouseName || toWarehouseName || 'Warehouse'}. ${entry.remarks || ''}`,
        userId,
        { warehouse: fromWarehouseName || toWarehouseName, valuationRate: item.valuation_rate }
      );
    }
  }
};

const deleteStockEntry = async (id) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [entries] = await connection.query('SELECT status FROM stock_entries WHERE id = ?', [id]);
    if (entries.length === 0) throw new Error('Stock Entry not found');
    
    // If submitted, we must reverse the stock ledger entries first
    if (entries[0].status === 'submitted') {
      const [ledgerEntries] = await connection.query(
        'SELECT id FROM stock_ledger WHERE reference_doc_type = "STOCK_ENTRY" AND reference_doc_id = ?',
        [id]
      );
      
      for (const le of ledgerEntries) {
        await stockService.deleteStockLedgerEntry(le.id, connection);
      }
    }
    
    await connection.execute('DELETE FROM stock_entries WHERE id = ?', [id]);
    
    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getStockEntryItemsFromGRN = async (grnId, connection = null) => {
  const executor = connection || pool;
  const [items] = await executor.query(`
    SELECT 
      poi.item_code,
      gi.accepted_qty as quantity,
      poi.unit as uom,
      poi.unit_rate as valuation_rate
    FROM grn_items gi
    JOIN purchase_order_items poi ON gi.po_item_id = poi.id
    WHERE gi.grn_id = ?
  `, [grnId]);
  
  return items;
};

const autoCreateStockEntryFromGRN = async (grnId, userId, providedConnection = null) => {
  console.log(`[StockEntry] Auto-creating for GRN: ${grnId}, User: ${userId}`);
  const connection = providedConnection || await pool.getConnection();
  const shouldRelease = !providedConnection;
  const shouldCommit = !providedConnection;

  try {
    if (shouldCommit) await connection.beginTransaction();

    // 1. Get GRN details
    const [grns] = await connection.query('SELECT * FROM grns WHERE id = ?', [grnId]);
    if (grns.length === 0) throw new Error('GRN not found');
    const grn = grns[0];

    // 2. Get default warehouse ID
    const [allWhs] = await connection.query('SELECT id, warehouse_name FROM warehouses');
    
    // Check if there's a warehouse assigned in the GRN items
    const [grnItemWhs] = await connection.query(
      'SELECT DISTINCT warehouse_id FROM grn_items WHERE grn_id = ? AND warehouse_id IS NOT NULL',
      [grnId]
    );

    let toWarehouseId = null;
    if (grnItemWhs.length > 0) {
      toWarehouseId = grnItemWhs[0].warehouse_id;
    } else {
      const preferredWh = allWhs.find(w => 
        w.warehouse_name === 'Consumables Store' || 
        w.warehouse_name === 'Main Warehouse' || 
        w.warehouse_name === 'RM-HOLD'
      );
      toWarehouseId = preferredWh ? preferredWh.id : (allWhs.length > 0 ? allWhs[0].id : null);
    }

    // 3. Get items from GRN
    const items = await getStockEntryItemsFromGRN(grnId, connection);

    if (items.length === 0) {
      if (shouldCommit) await connection.rollback();
      return { success: false, message: 'No items in GRN' };
    }

    // 4. Create Stock Entry
    const entryNo = await generateEntryNo('Material Receipt');

    const [result] = await connection.execute(
      `INSERT INTO stock_entries 
       (entry_no, entry_type, purpose, to_warehouse_id, entry_date, grn_id, remarks, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entryNo,
        'Material Receipt',
        'Stock Receipt from GRN',
        toWarehouseId,
        grn.grn_date || new Date(),
        grnId,
        `Auto-created from GRN ${grn.po_number}`,
        userId,
        'submitted'
      ]
    );

    const entryId = result.insertId;

    // 5. Create Stock Entry Items
    let itemsAdded = 0;
    for (const item of items) {
      if (parseFloat(item.quantity) <= 0) continue;
      
      await connection.execute(
        `INSERT INTO stock_entry_items 
         (stock_entry_id, item_code, quantity, uom, valuation_rate, amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          entryId,
          item.item_code,
          item.quantity,
          item.uom || 'NOS',
          item.valuation_rate || 0,
          (item.quantity * (item.valuation_rate || 0))
        ]
      );
      itemsAdded++;
    }

    if (itemsAdded === 0) {
      if (shouldCommit) await connection.rollback();
      return { success: false, message: 'No items with positive quantity' };
    }

    // 6. Process Stock Movement
    await processStockMovement(entryId, connection, userId);

    if (shouldCommit) await connection.commit();
    return { success: true, entryId, entryNo };
  } catch (error) {
    if (shouldCommit) await connection.rollback();
    console.error('[StockEntry] Error auto-creating stock entry:', error);
    throw error;
  } finally {
    if (shouldRelease) connection.release();
  }
};

module.exports = {
  getAllStockEntries,
  getStockEntryById,
  createStockEntry,
  submitStockEntry,
  deleteStockEntry,
  getStockEntryItemsFromGRN,
  autoCreateStockEntryFromGRN
};
