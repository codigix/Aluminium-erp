const pool = require('../config/db');
const stockService = require('./stockService');

const GRN_ITEM_STATUS = {
  Approved : 'Approved ',
  SHORTAGE: 'SHORTAGE',
  OVERAGE: 'OVERAGE'
};

const validateGRNItemInput = (poQty, acceptedQty) => {
  const errors = [];

  if (acceptedQty < 0) {
    errors.push('Accepted Qty cannot be negative');
  }

  if (!acceptedQty && acceptedQty !== 0) {
    errors.push('Accepted Qty is required');
  }

  if (errors.length > 0) {
    const error = new Error(errors.join('; '));
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }
};

const determineGRNItemStatus = (poQty, acceptedQty) => {
  if (acceptedQty === poQty) {
    return GRN_ITEM_STATUS.Approved ;
  }

  if (acceptedQty < poQty) {
    return GRN_ITEM_STATUS.SHORTAGE;
  }

  if (acceptedQty > poQty) {
    return GRN_ITEM_STATUS.OVERAGE;
  }

  return GRN_ITEM_STATUS.Approved ;
};

const calculatePOBalance = (poQty, totalAcceptedQty) => {
  return poQty - totalAcceptedQty;
};

const determineInventoryPostingQty = (acceptedQty, rejectedQty, isApproved = false) => {
  if (rejectedQty > 0) {
    return acceptedQty;
  }

  return acceptedQty;
};

const createGRNItem = async (grnId, poItemId, poQty, acceptedQty, remarks = null, warehouseId = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    validateGRNItemInput(poQty, acceptedQty);

    const [poItem] = await connection.query('SELECT item_code, description, length, width, thickness, diameter, outer_diameter, density, weight_per_unit, shape_type, uom FROM purchase_order_items WHERE id = ?', [poItemId]);
    const itemDescription = poItem.length ? poItem[0].description : null;

    const grnItemStatus = determineGRNItemStatus(poQty, acceptedQty);
    const shortageQty = acceptedQty < poQty ? poQty - acceptedQty : 0;
    const overageQty = acceptedQty > poQty ? acceptedQty - poQty : 0;
    const receivedQty = acceptedQty;
    const rejectedQty = 0;

    const length = poItem.length ? poItem[0].length : 0;
    const width = poItem.length ? poItem[0].width : 0;
    const thickness = poItem.length ? poItem[0].thickness : 0;
    const diameter = poItem.length ? poItem[0].diameter : 0;
    const outer_diameter = poItem.length ? poItem[0].outer_diameter : 0;
    const density = poItem.length ? poItem[0].density : 0;
    const weight_per_unit = poItem.length ? poItem[0].weight_per_unit : 0;
    const shape_type = poItem.length ? poItem[0].shape_type : null;
    const uom = poItem.length ? poItem[0].uom : null;

    const [result] = await connection.execute(
      `INSERT INTO grn_items (
        grn_id, po_item_id, po_qty, received_qty, accepted_qty, rejected_qty,
        shortage_qty, overage_qty, status, remarks, is_approved, warehouse_id,
        length, width, thickness, diameter, outer_diameter, density, weight_per_unit, shape_type, uom
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        grnId,
        poItemId,
        poQty,
        receivedQty,
        acceptedQty,
        rejectedQty,
        shortageQty,
        overageQty,
        grnItemStatus,
        remarks,
        false,
        warehouseId,
        length,
        width,
        thickness,
        diameter,
        outer_diameter,
        density,
        weight_per_unit,
        shape_type,
        uom
      ]
    );

    const grnItemId = result.insertId;

    await connection.commit();

    return {
      id: grnItemId,
      grn_id: grnId,
      po_item_id: poItemId,
      po_qty: poQty,
      received_qty: receivedQty,
      accepted_qty: acceptedQty,
      rejected_qty: rejectedQty,
      shortage_qty: shortageQty,
      overage_qty: overageQty,
      status: grnItemStatus,
      remarks,
      is_approved: false,
      warehouse_id: warehouseId
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateGRNItem = async (grnItemId, updates) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existingItem] = await connection.query(
      'SELECT * FROM grn_items WHERE id = ?',
      [grnItemId]
    );

    if (!existingItem.length) {
      throw new Error('GRN Item not found');
    }

    const item = existingItem[0];
    const {
      receivedQty = item.received_qty,
      acceptedQty = item.accepted_qty,
      rejectedQty = item.rejected_qty,
      remarks
    } = updates;

    validateGRNItemInput(item.po_qty, receivedQty, acceptedQty, rejectedQty);

    const shortageQty = receivedQty < item.po_qty ? item.po_qty - receivedQty : 0;
    const overageQty = receivedQty > item.po_qty ? receivedQty - item.po_qty : 0;
    const newStatus = determineGRNItemStatus(item.po_qty, receivedQty, acceptedQty, rejectedQty, item.is_approved);

    await connection.execute(
      `UPDATE grn_items SET
        received_qty = ?, accepted_qty = ?, rejected_qty = ?,
        shortage_qty = ?, overage_qty = ?, status = ?, remarks = ?
       WHERE id = ?`,
      [
        receivedQty,
        acceptedQty,
        rejectedQty,
        shortageQty,
        overageQty,
        newStatus,
        remarks || item.remarks,
        grnItemId
      ]
    );

    const [poItem] = await connection.query(
      'SELECT item_code, description FROM purchase_order_items WHERE id = ?',
      [item.po_item_id]
    );

    const itemCode = poItem.length ? poItem[0].item_code : null;
    const itemDescription = poItem.length ? poItem[0].description : null;

    if (newStatus === GRN_ITEM_STATUS.EXCESS_HOLD && overageQty > 0) {
      const [existingApproval] = await connection.query(
        'SELECT id FROM grn_excess_approvals WHERE grn_item_id = ?',
        [grnItemId]
      );

      if (existingApproval.length) {
        await connection.execute(
          'UPDATE grn_excess_approvals SET excess_qty = ? WHERE grn_item_id = ?',
          [overageQty, grnItemId]
        );
      } else {
        await connection.execute(
          `INSERT INTO grn_excess_approvals (grn_item_id, excess_qty, status)
           VALUES (?, ?, ?)`,
          [grnItemId, overageQty, 'PENDING']
        );
      }
    }

    await connection.commit();

    return {
      id: grnItemId,
      po_qty: item.po_qty,
      received_qty: receivedQty,
      accepted_qty: acceptedQty,
      rejected_qty: rejectedQty,
      shortage_qty: shortageQty,
      overage_qty: overageQty,
      status: newStatus,
      remarks: remarks || item.remarks,
      is_approved: item.is_approved
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const approveExcessGRNItem = async (grnItemId, approvalNotes = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existingItem] = await connection.query(
      'SELECT * FROM grn_items WHERE id = ?',
      [grnItemId]
    );

    if (!existingItem.length) {
      throw new Error('GRN Item not found');
    }

    const item = existingItem[0];

    if (item.overage_qty <= 0) {
      throw new Error('No overage quantity to approve');
    }

    await connection.execute(
      `UPDATE grn_items SET
        status = ?, is_approved = ?
       WHERE id = ?`,
      [GRN_ITEM_STATUS.EXCESS_ACCEPTED, true, grnItemId]
    );

    await connection.execute(
      `UPDATE grn_excess_approvals SET
        status = ?, approval_notes = ?, approved_at = NOW()
       WHERE grn_item_id = ?`,
      [
        'Approved ',
        approvalNotes,
        grnItemId
      ]
    );

    await connection.commit();

    return {
      id: grnItemId,
      status: GRN_ITEM_STATUS.EXCESS_ACCEPTED,
      is_approved: true,
      message: 'Excess quantity approved'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const rejectExcessGRNItem = async (grnItemId, rejectionReason = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existingItem] = await connection.query(
      'SELECT * FROM grn_items WHERE id = ?',
      [grnItemId]
    );

    if (!existingItem.length) {
      throw new Error('GRN Item not found');
    }

    const item = existingItem[0];

    if (item.overage_qty <= 0) {
      throw new Error('No overage quantity to reject');
    }

    await connection.execute(
      `UPDATE grn_items SET
        accepted_qty = ?, status = ?
       WHERE id = ?`,
      [item.po_qty, GRN_ITEM_STATUS.RECEIVED, grnItemId]
    );

    await connection.execute(
      `UPDATE grn_excess_approvals SET
        status = ?, rejection_reason = ?, rejected_at = NOW()
       WHERE grn_item_id = ?`,
      [
        'REJECTED',
        rejectionReason,
        grnItemId
      ]
    );

    await connection.commit();

    return {
      id: grnItemId,
      status: GRN_ITEM_STATUS.RECEIVED,
      is_approved: false,
      message: 'Excess quantity rejected',
      accepted_qty: item.po_qty
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getGRNItemsByGrnId = async (grnId) => {
  const [items] = await pool.query(
    `SELECT 
      gi.*,
      poi.item_code,
      poi.description,
      poi.unit,
      poi.unit_rate,
      poi.amount,
      poi.material_name,
      poi.material_type,
      poi.drawing_no,
      COALESCE(NULLIF(gi.length, 0), NULLIF(poi.length, 0), 0) as length,
      COALESCE(NULLIF(gi.width, 0), NULLIF(poi.width, 0), 0) as width,
      COALESCE(NULLIF(gi.thickness, 0), NULLIF(poi.thickness, 0), 0) as thickness,
      COALESCE(NULLIF(gi.diameter, 0), NULLIF(poi.diameter, 0), 0) as diameter,
      COALESCE(NULLIF(gi.outer_diameter, 0), NULLIF(poi.outer_diameter, 0), 0) as outer_diameter,
      COALESCE(NULLIF(gi.density, 0), NULLIF(poi.density, 0), 0) as density,
      COALESCE(NULLIF(gi.weight_per_unit, 0), NULLIF(poi.weight_per_unit, 0), 0) as weight_per_unit,
      COALESCE(gi.shape_type, poi.shape_type, shape_lookup.shape_name, (SELECT name FROM shapes WHERE id = sb.shape_id LIMIT 1)) as shape_type,
      COALESCE(gi.shape_type, poi.shape_type, shape_lookup.shape_name, (SELECT name FROM shapes WHERE id = sb.shape_id LIMIT 1)) as shape_name,
      gea.id as excess_approval_id,
      gea.status as excess_approval_status,
      gea.excess_qty
    FROM grn_items gi
    LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
    LEFT JOIN (
        SELECT item_code, MAX(shape_id) as shape_id FROM stock_balance GROUP BY item_code
    ) sb ON poi.item_code = sb.item_code
    LEFT JOIN (
        SELECT som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter,
               MAX(s.name) as shape_name
        FROM sales_order_item_materials som
        LEFT JOIN shapes s ON som.shape_id = s.id
        WHERE s.id IS NOT NULL
        GROUP BY som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter
    ) shape_lookup ON (
        LOWER(TRIM(REPLACE(poi.material_name, '\t', ''))) = LOWER(TRIM(REPLACE(shape_lookup.material_name, '\t', '')))
        AND ABS(COALESCE(poi.length, 0) - COALESCE(shape_lookup.length, 0)) < 0.0001
        AND ABS(COALESCE(poi.width, 0) - COALESCE(shape_lookup.width, 0)) < 0.0001
        AND ABS(COALESCE(poi.thickness, 0) - COALESCE(shape_lookup.thickness, 0)) < 0.0001
        AND ABS(COALESCE(poi.diameter, 0) - COALESCE(shape_lookup.diameter, 0)) < 0.0001
        AND ABS(COALESCE(poi.outer_diameter, 0) - COALESCE(shape_lookup.outer_diameter, 0)) < 0.0001
    )
    LEFT JOIN grn_excess_approvals gea ON gi.id = gea.grn_item_id
    WHERE gi.grn_id = ?
    ORDER BY gi.created_at ASC`,
    [grnId]
  );

  return items;
};


const getPOBalance = async (poItemId, excludeGrnId = null) => {
  let query = `
    SELECT 
      poi.id,
      poi.purchase_order_id,
      poi.item_code,
      poi.description,
      poi.quantity as po_qty,
      COALESCE(SUM(CASE WHEN gi.status != 'REJECTED' THEN gi.accepted_qty ELSE 0 END), 0) as total_accepted_qty
    FROM purchase_order_items poi
    LEFT JOIN grn_items gi ON poi.id = gi.po_item_id AND gi.status != 'REJECTED'
    WHERE poi.id = ?
  `;

  const params = [poItemId];

  if (excludeGrnId) {
    query += ` AND gi.grn_id != ?`;
    params.push(excludeGrnId);
  }

  query += ` GROUP BY poi.id`;

  const [result] = await pool.query(query, params);

  if (!result.length) {
    return null;
  }

  const item = result[0];
  return {
    po_item_id: item.id,
    po_qty: item.po_qty,
    total_accepted_qty: item.total_accepted_qty,
    balance_qty: item.po_qty - item.total_accepted_qty,
    item_code: item.item_code,
    description: item.description
  };
};

const getSummaryByGrnId = async (grnId) => {
  const [items] = await pool.query(
    `SELECT 
      gi.status,
      COUNT(*) as item_count,
      SUM(gi.po_qty) as total_po_qty,
      SUM(gi.received_qty) as total_received_qty,
      SUM(gi.accepted_qty) as total_accepted_qty,
      SUM(gi.rejected_qty) as total_rejected_qty,
      SUM(gi.shortage_qty) as total_shortage_qty,
      SUM(gi.overage_qty) as total_overage_qty
    FROM grn_items gi
    WHERE gi.grn_id = ?
    GROUP BY gi.status`,
    [grnId]
  );

  const summary = {
    total_items: 0,
    total_po_qty: 0,
    total_received_qty: 0,
    total_accepted_qty: 0,
    total_rejected_qty: 0,
    total_shortage_qty: 0,
    total_overage_qty: 0,
    by_status: {}
  };

  items.forEach(item => {
    summary.total_items += item.item_count || 0;
    summary.total_po_qty += item.total_po_qty || 0;
    summary.total_received_qty += item.total_received_qty || 0;
    summary.total_accepted_qty += item.total_accepted_qty || 0;
    summary.total_rejected_qty += item.total_rejected_qty || 0;
    summary.total_shortage_qty += item.total_shortage_qty || 0;
    summary.total_overage_qty += item.total_overage_qty || 0;

    summary.by_status[item.status] = {
      count: item.item_count,
      received_qty: item.total_received_qty || 0,
      accepted_qty: item.total_accepted_qty || 0,
      rejected_qty: item.total_rejected_qty || 0
    };
  });

  return summary;
};

const calculateGRNStatus = (grnItems) => {
  if (!grnItems || grnItems.length === 0) {
    return 'PENDING';
  }

  const statuses = grnItems.map(item => item.status);
  
  if (statuses.includes('OVERAGE')) {
    return 'EXCESS';
  }
  
  if (statuses.includes('SHORTAGE')) {
    return 'PARTIAL';
  }
  
  if (statuses.every(s => s === 'Approved ')) {
    return 'Approved ';
  }
  
  return 'PENDING';
};

const deleteGRNItem = async (grnItemId) => {
  const [result] = await pool.execute(
    'DELETE FROM grn_items WHERE id = ?',
    [grnItemId]
  );

  if (result.affectedRows === 0) {
    const error = new Error('GRN Item not found');
    error.statusCode = 404;
    throw error;
  }

  return result;
};

module.exports = {
  GRN_ITEM_STATUS,
  validateGRNItemInput,
  determineGRNItemStatus,
  calculatePOBalance,
  determineInventoryPostingQty,
  createGRNItem,
  updateGRNItem,
  approveExcessGRNItem,
  rejectExcessGRNItem,
  getGRNItemsByGrnId,
  getPOBalance,
  getSummaryByGrnId,
  calculateGRNStatus,
  deleteGRNItem
};
