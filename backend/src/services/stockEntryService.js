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
  const [entries] = await connection.query('SELECT * FROM stock_entries WHERE id = ?', [entryId]);
  const entry = entries[0];
  const [items] = await connection.query('SELECT * FROM stock_entry_items WHERE stock_entry_id = ?', [entryId]);

  const [fromWh] = entry.from_warehouse_id ? await connection.query('SELECT warehouse_name FROM warehouses WHERE id = ?', [entry.from_warehouse_id]) : [[]];
  const [toWh] = entry.to_warehouse_id ? await connection.query('SELECT warehouse_name FROM warehouses WHERE id = ?', [entry.to_warehouse_id]) : [[]];

  const fromWarehouseName = fromWh[0]?.warehouse_name;
  const toWarehouseName = toWh[0]?.warehouse_name;

  for (const item of items) {
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
        { warehouse: toWarehouseName, valuationRate: item.valuation_rate }
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
  const [entries] = await pool.query('SELECT status FROM stock_entries WHERE id = ?', [id]);
  if (entries.length === 0) throw new Error('Stock Entry not found');
  if (entries[0].status === 'submitted') throw new Error('Cannot delete submitted stock entry');
  
  await pool.query('DELETE FROM stock_entries WHERE id = ?', [id]);
  return { success: true };
};

const getStockEntryItemsFromGRN = async (grnId) => {
  const [items] = await pool.query(`
    SELECT 
      poi.item_code,
      gi.accepted_qty as quantity,
      poi.unit as uom,
      poi.unit_rate as valuation_rate
    FROM grn_items gi
    JOIN purchase_order_items poi ON gi.po_item_id = poi.id
    WHERE gi.grn_id = ? AND gi.is_approved = 1
  `, [grnId]);
  
  return items;
};

module.exports = {
  getAllStockEntries,
  getStockEntryById,
  createStockEntry,
  submitStockEntry,
  deleteStockEntry,
  getStockEntryItemsFromGRN
};
