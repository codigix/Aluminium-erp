const pool = require('../config/db');
const stockService = require('./stockService');

const getPendingAllocations = async () => {
  const [rows] = await pool.query(`
    SELECT 
      gi.id as grn_item_id,
      g.id as grn_id,
      CONCAT('GRN-', LPAD(g.id, 4, '0')) as grn_number,
      g.po_number,
      poi.item_code,
      poi.material_name,
      poi.material_type,
      gi.received_qty,
      gi.accepted_qty,
      gi.allocated_qty,
      (gi.accepted_qty - gi.allocated_qty) as pending_allocation_qty,
      'RM-HOLD' as current_warehouse
    FROM grn_items gi
    JOIN grns g ON gi.grn_id = g.id
    JOIN purchase_order_items poi ON gi.po_item_id = poi.id
    WHERE gi.accepted_qty > gi.allocated_qty
      AND gi.allocation_status != 'FULLY_ALLOCATED'
    ORDER BY g.created_at DESC
  `);
  return rows;
};

const allocateWarehouse = async (allocationData, userId) => {
  const { grn_item_id, target_warehouse, allocate_qty, remarks } = allocationData;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Fetch current GRN item details for validation and ledger
    const [grnItems] = await connection.query(`
      SELECT 
        gi.id, gi.grn_id, gi.accepted_qty, gi.allocated_qty, 
        poi.item_code, poi.material_name, poi.material_type
      FROM grn_items gi
      JOIN purchase_order_items poi ON gi.po_item_id = poi.id
      WHERE gi.id = ? FOR UPDATE
    `, [grn_item_id]);

    if (grnItems.length === 0) {
      throw new Error('GRN item not found');
    }

    const item = grnItems[0];
    const pendingQty = item.accepted_qty - item.allocated_qty;

    if (allocate_qty > pendingQty) {
      throw new Error(`Allocation quantity (${allocate_qty}) exceeds pending quantity (${pendingQty})`);
    }

    if (allocate_qty <= 0) {
      throw new Error('Allocation quantity must be greater than zero');
    }

    // 2. Create Warehouse Allocation record (Audit Trail)
    const [allocResult] = await connection.execute(`
      INSERT INTO warehouse_allocations (grn_item_id, from_warehouse, to_warehouse, quantity, allocated_by)
      VALUES (?, ?, ?, ?, ?)
    `, [grn_item_id, 'RM-HOLD', target_warehouse, allocate_qty, userId]);

    // 3. Update GRN Item status and allocated_qty
    const newAllocatedQty = parseFloat(item.allocated_qty) + parseFloat(allocate_qty);
    const newStatus = newAllocatedQty >= item.accepted_qty ? 'FULLY_ALLOCATED' : 'PARTIAL';

    await connection.execute(`
      UPDATE grn_items 
      SET allocated_qty = ?, allocation_status = ?
      WHERE id = ?
    `, [newAllocatedQty, newStatus, grn_item_id]);

    // 4. Update Stock Ledger (2 entries: OUT from RM-HOLD, IN to Target WH)
    const grnNumber = `GRN-${String(item.grn_id).padStart(4, '0')}`;

    // Create OUT entry from source warehouse
    await stockService.addStockLedgerEntry(
      item.item_code,
      'OUT',
      allocate_qty,
      'WAREHOUSE_ALLOCATION',
      allocResult.insertId,
      grnNumber,
      `Transfer from RM-HOLD to ${target_warehouse} (${remarks || ''})`,
      userId,
      { 
        connection, 
        warehouse: 'RM-HOLD',
        materialName: item.material_name,
        materialType: item.material_type
      }
    );

    // Create IN entry to target warehouse
    await stockService.addStockLedgerEntry(
      item.item_code,
      'IN',
      allocate_qty,
      'WAREHOUSE_ALLOCATION',
      allocResult.insertId,
      grnNumber,
      `Transfer to ${target_warehouse} from RM-HOLD (${remarks || ''})`,
      userId,
      { 
        connection, 
        warehouse: target_warehouse,
        materialName: item.material_name,
        materialType: item.material_type
      }
    );

    await connection.commit();
    return { success: true, allocationId: allocResult.insertId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getPendingAllocations,
  allocateWarehouse
};
