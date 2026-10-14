const pool = require('../config/db');
const stockService = require('./stockService');
const { nextDocumentNumber } = require('../utils/documentNumber');
const { logProductionEvent } = require('./productionAuditService');
const { QTY_TOLERANCE, productionError, WORK_ORDER_BLOCKED_FOR_ACTIVITY } = require('../config/productionWorkflow');

// Released quantity of one material on a plan's Material Requests, minus what was
// already allocated to the plan's work orders. Matches by item code or material name.
const getPlanIssuable = async (connection, planId, itemCode, materialName) => {
  const [[released]] = await connection.query(
    // Weight materials (kg): the released kilograms are in allocated_weight when Stores recorded a weight,
    // otherwise (as in most existing data) in allocated_quantity. Issues are in the material's own unit.
    `SELECT COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(mri.uom, ''))) IN ('kg', 'kgs', 'kilogram') THEN COALESCE(NULLIF(mri.allocated_weight, 0), mri.allocated_quantity) ELSE mri.allocated_quantity END), 0) AS qty
     FROM material_request_items mri JOIN material_requests mr ON mri.mr_id = mr.id
     WHERE mr.plan_id = ? AND UPPER(COALESCE(mr.status, '')) NOT IN ('CANCELLED', 'REJECTED')
       AND ((? IS NOT NULL AND mri.item_code = ?) OR (? IS NOT NULL AND LOWER(TRIM(mri.item_name)) = LOWER(TRIM(?))))`,
    [planId, itemCode || null, itemCode || null, materialName || null, materialName || null]
  );
  const [[allocated]] = await connection.query(
    `SELECT COALESCE(SUM(mii.quantity), 0) AS qty
     FROM material_issue_items mii
     JOIN material_issues mi ON mii.issue_id = mi.id
     JOIN work_orders wo ON mi.work_order_id = wo.id
     WHERE wo.plan_id = ?
       AND ((? IS NOT NULL AND mii.item_code = ?) OR (? IS NOT NULL AND LOWER(TRIM(mii.material_name)) = LOWER(TRIM(?))))`,
    [planId, itemCode || null, itemCode || null, materialName || null, materialName || null]
  );
  const releasedQty = parseFloat(released.qty) || 0;
  const allocatedQty = parseFloat(allocated.qty) || 0;
  return { released: releasedQty, allocated: allocatedQty, issuable: Math.max(0, releasedQty - allocatedQty) };
};


const listMaterialIssues = async () => {
  const [rows] = await pool.query(
    `SELECT mi.*, wo.wo_number, u.username as issuer_name
     FROM material_issues mi
     JOIN work_orders wo ON mi.work_order_id = wo.id
     LEFT JOIN users u ON mi.issued_by = u.id
     ORDER BY mi.issued_date DESC`
  );
  return rows;
};

const getMaterialIssueById = async (id) => {
  const [rows] = await pool.query(
    `SELECT mi.*, wo.wo_number, u.username as issuer_name
     FROM material_issues mi
     JOIN work_orders wo ON mi.work_order_id = wo.id
     LEFT JOIN users u ON mi.issued_by = u.id
     WHERE mi.id = ?`,
    [id]
  );
  
  if (rows.length === 0) return null;
  
  const [items] = await pool.query(
    'SELECT * FROM material_issue_items WHERE issue_id = ?',
    [id]
  );
  
  return { ...rows[0], items };
};

const createMaterialIssue = async (data, userId) => {
  const { workOrderId, remarks, items } = data;

  if (!Array.isArray(items) || items.length === 0) {
    throw productionError('Add at least one material to issue', 400);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [woRows] = await connection.query('SELECT id, plan_id, status, wo_number FROM work_orders WHERE id = ? FOR UPDATE', [workOrderId]);
    if (woRows.length === 0) throw productionError('Work Order not found', 404);
    const wo = woRows[0];
    if (WORK_ORDER_BLOCKED_FOR_ACTIVITY.includes(wo.status)) {
      throw productionError(`Cannot issue material: Work Order ${wo.wo_number} is ${wo.status}`);
    }

    // A plan's stock leaves the store when its Material Request is released, so an issue
    // only allocates released material to the work order. Work orders without a plan
    // have no release step, so the issue itself deducts the stock.
    const planBacked = Boolean(wo.plan_id);

    const issueNumber = await nextDocumentNumber(connection, 'MATERIAL_ISSUE');
    const [result] = await connection.execute(
      `INSERT INTO material_issues (issue_number, work_order_id, issued_by, remarks, stock_source)
       VALUES (?, ?, ?, ?, ?)`,
      [issueNumber, workOrderId, userId, remarks, planBacked ? 'MR_RELEASE' : 'DIRECT']
    );
    const issueId = result.insertId;

    // Items in one request for the same material add up against the same release
    const requestedSoFar = new Map();

    for (const item of items) {
      const qty = parseFloat(item.quantity);
      if (!(qty > 0)) {
        throw productionError(`Issue quantity for ${item.materialName || item.itemCode || 'material'} must be greater than zero`, 400);
      }

      let itemIdentifier = item.itemCode;
      if (!itemIdentifier) {
        // Try to find item_code from stock_balance based on material_name, type, and dimensions
        const [stockRows] = await connection.query(
          `SELECT item_code FROM stock_balance
           WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?))
             AND (material_type = ? OR UPPER(REPLACE(material_type, ' ', '_')) = UPPER(REPLACE(?, ' ', '_')))
             AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
             AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
             AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
             AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
             AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)
           LIMIT 1`,
          [
            item.materialName, item.materialType, item.materialType,
            item.length || 0, item.width || 0, item.thickness || 0, item.diameter || 0, item.outer_diameter || item.outerDiameter || 0
          ]
        );
        if (stockRows.length > 0) {
          itemIdentifier = stockRows[0].item_code;
        } else {
          // Fallback to name only if still not found
          const [stockNameOnly] = await connection.query(
            'SELECT item_code FROM stock_balance WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?)) LIMIT 1',
            [item.materialName]
          );
          if (stockNameOnly.length > 0) {
            itemIdentifier = stockNameOnly[0].item_code;
          }
        }
      }

      if (planBacked) {
        const key = `${itemIdentifier || ''}|${String(item.materialName || '').toLowerCase().trim()}`;
        const alreadyRequested = requestedSoFar.get(key) || 0;
        const { released, issuable } = await getPlanIssuable(connection, wo.plan_id, itemIdentifier, item.materialName);
        if (released <= 0) {
          throw productionError(`${item.materialName || itemIdentifier} has not been released on this plan's Material Request yet. Release it from Stores first.`);
        }
        if (alreadyRequested + qty > issuable + QTY_TOLERANCE) {
          throw productionError(`Cannot issue ${qty} of ${item.materialName || itemIdentifier}: only ${Math.max(0, issuable - alreadyRequested)} of the ${released} released remains unallocated.`);
        }
        requestedSoFar.set(key, alreadyRequested + qty);
      }

      await connection.execute(
        `INSERT INTO material_issue_items (issue_id, material_name, material_type, item_code, quantity, uom, warehouse)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [issueId, item.materialName, item.materialType, itemIdentifier || null, qty, item.uom, item.warehouse]
      );

      if (!planBacked) {
        if (!itemIdentifier) {
          throw productionError(`No stock record found for ${item.materialName}; cannot deduct stock for a direct issue`, 400);
        }
        await stockService.addStockLedgerEntry(
          itemIdentifier,
          'OUT',
          qty,
          'MATERIAL_ISSUE',
          issueId,
          issueNumber,
          `Issued for Work Order ${wo.wo_number}`,
          userId,
          {
            connection,
            warehouse: item.warehouse,
            materialName: item.materialName,
            materialType: item.materialType,
            unit: item.uom,
            shape_type: item.shape_type || item.shapeType || item.shape_name,
            length: item.length !== undefined && item.length !== null ? parseFloat(item.length) : undefined,
            width: item.width !== undefined && item.width !== null ? parseFloat(item.width) : undefined,
            thickness: item.thickness !== undefined && item.thickness !== null ? parseFloat(item.thickness) : undefined,
            diameter: item.diameter !== undefined && item.diameter !== null ? parseFloat(item.diameter) : undefined,
            outer_diameter: item.outer_diameter !== undefined && item.outer_diameter !== null ? parseFloat(item.outer_diameter) : (item.outerDiameter !== undefined && item.outerDiameter !== null ? parseFloat(item.outerDiameter) : undefined),
            density: item.density !== undefined && item.density !== null ? parseFloat(item.density) : undefined
          }
        );
      }
    }

    await logProductionEvent(connection, {
      entityType: 'MATERIAL_ISSUE', entityId: issueId, action: 'CREATE',
      newValue: `${issueNumber}: ${items.length} item(s) to ${wo.wo_number} (${planBacked ? 'allocated from MR release' : 'direct stock issue'})`, userId
    });

    await connection.commit();
    return issueId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getPlanIssuable,
  listMaterialIssues,
  getMaterialIssueById,
  createMaterialIssue
};
