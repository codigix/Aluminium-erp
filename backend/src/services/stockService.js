const pool = require('../config/db');

const calculateBalanceDetailsFromLedger = async (itemCode, warehouse = null, connection = null, dimensions = null) => {
  const executor = connection || pool;
  let query = `
    SELECT 
      SUM(qty_in) as accepted_qty,
      SUM(qty_out) as issued_qty,
      SUM(qty_in - qty_out) as current_balance,
      SUM(weight_in) as total_weight_in,
      SUM(weight_out) as total_weight_out,
      SUM(weight_in - weight_out) as current_weight
    FROM stock_ledger 
    WHERE item_code = ?
  `;

  const params = [itemCode];
  if (warehouse && warehouse !== 'ALL') {
    query += ` AND warehouse = ? `;
    params.push(warehouse);
  } else if (warehouse === null || warehouse === '') {
    query += ` AND (warehouse IS NULL OR warehouse = '') `;
  }

  if (dimensions && typeof dimensions === 'object') {
    const length = parseFloat(dimensions.length || 0);
    const width = parseFloat(dimensions.width || 0);
    const thickness = parseFloat(dimensions.thickness || 0);
    const diameter = parseFloat(dimensions.diameter || 0);
    const outerDiameter = parseFloat(dimensions.outer_diameter || dimensions.outerDiameter || 0);

    query += `
      AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
      AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
      AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
      AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
      AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)
    `;
    params.push(length, width, thickness, diameter, outerDiameter);
  }

  const [ledgerData] = await executor.query(query, params);

  const ledger = ledgerData[0] || {};
  return {
    received_qty: parseFloat(ledger.accepted_qty) || 0,
    accepted_qty: parseFloat(ledger.accepted_qty) || 0,
    issued_qty: parseFloat(ledger.issued_qty) || 0,
    current_balance: Math.max(0, parseFloat(ledger.current_balance) || 0),
    current_weight: Math.max(0, parseFloat(ledger.current_weight) || 0)
  };
};

const deleteStockLedgerEntry = async (id, externalConnection = null) => {
  const connection = externalConnection || await pool.getConnection();
  const shouldRelease = !externalConnection;

  try {
    if (shouldRelease) {
      await connection.beginTransaction();
    }

    const [entries] = await connection.query('SELECT item_code, warehouse FROM stock_ledger WHERE id = ?', [id]);
    if (entries.length === 0) {
      const error = new Error('Ledger entry not found');
      error.statusCode = 404;
      throw error;
    }

    const { item_code, warehouse } = entries[0];

    await connection.execute('DELETE FROM stock_ledger WHERE id = ?', [id]);

    const details = await calculateBalanceDetailsFromLedger(item_code, warehouse, connection);

    await connection.execute(`
      UPDATE stock_balance 
      SET current_balance = ?, current_weight = ?, last_updated = CURRENT_TIMESTAMP
      WHERE item_code = ? AND (warehouse = ? OR (warehouse IS NULL AND ? IS NULL))
    `, [details.current_balance, details.current_weight, item_code, warehouse, warehouse]);

    if (shouldRelease) {
      await connection.commit();
    }
    return { success: true };
  } catch (error) {
    if (shouldRelease) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (shouldRelease) {
      connection.release();
    }
  }
};

const deleteStockBalance = async (id) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get the item_code of the stock balance record
    const [balanceRows] = await connection.query(
      'SELECT item_code FROM stock_balance WHERE id = ?',
      [id]
    );

    if (balanceRows.length === 0) {
      const error = new Error('Stock balance not found');
      error.statusCode = 404;
      throw error;
    }

    const itemCode = balanceRows[0].item_code;

    // 2. Delete all related stock ledger entries for this item_code
    await connection.execute(
      'DELETE FROM stock_ledger WHERE item_code = ?',
      [itemCode]
    );

    // 3. Delete all stock balance records for this item_code
    await connection.execute(
      'DELETE FROM stock_balance WHERE item_code = ?',
      [itemCode]
    );

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getStockLedger = async (itemCode = null, startDate = null, endDate = null) => {
  let query = `SELECT 
    sl.id,
    sl.item_code,
    sl.material_name,
    sl.material_type,
    sl.transaction_date,
    sl.transaction_type,
    sl.quantity,
    sl.weight_in,
    sl.weight_out,
    sl.weight_after,
    sl.reference_doc_type,
    sl.reference_doc_id,
    sl.reference_doc_number,
    sl.qc_id,
    sl.grn_item_id,
    sl.balance_after,
    sl.remarks,
    sl.created_at,
    sb.shape_id as shape_id,
    COALESCE(sl.length, grn.length, sb.length) as length,
    COALESCE(sl.width, grn.width, sb.width) as width,
    COALESCE(sl.thickness, grn.thickness, sb.thickness) as thickness,
    COALESCE(sl.diameter, grn.diameter, sb.diameter) as diameter,
    COALESCE(sl.outer_diameter, grn.outer_diameter, sb.outer_diameter) as outer_diameter,
    COALESCE(sl.material_grade, sb.material_grade) as material_grade,
    grn.shape_type as grn_shape_type
  FROM stock_ledger sl
  LEFT JOIN grn_items grn ON sl.grn_item_id = grn.id
  LEFT JOIN (
    SELECT 
      item_code, 
      MAX(shape_id) as shape_id, 
      MAX(length) as length, 
      MAX(width) as width, 
      MAX(thickness) as thickness, 
      MAX(diameter) as diameter, 
      MAX(outer_diameter) as outer_diameter,
      MAX(material_grade) as material_grade
    FROM stock_balance
    GROUP BY item_code
  ) sb ON sl.item_code = sb.item_code`;

  const conditions = [];
  const params = [];

  if (itemCode) {
    conditions.push('sl.item_code = ?');
    params.push(itemCode);
  }

  if (startDate) {
    conditions.push('sl.transaction_date >= ?');
    params.push(startDate);
  }

  if (endDate) {
    conditions.push('sl.transaction_date <= ?');
    params.push(endDate);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  // Filter out FG and Sub Assembly
  if (conditions.length > 0) {
    query += " AND UPPER(sl.material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')";
  } else {
    query += " WHERE UPPER(sl.material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')";
  }

  query += ' ORDER BY sl.transaction_date DESC, sl.id DESC';

  const [ledger] = await pool.query(query, params);
  return ledger;
};

const getStockBalance = async (drawingNo = null, includeAll = false) => {
  const params = [];

  if (includeAll) {
    // Items Master view: aggregate all dimension records of the same material into one generic row.
    // Prefer canonical RM- codes over dimension-specific RAW- codes for the item_code column.
    let query = `
      SELECT 
        MAX(sb.id) as id,
        MAX(sb.public_id) as public_id,
        COALESCE(
          MAX(CASE WHEN sb.item_code LIKE 'RM-%' THEN sb.item_code END),
          MIN(sb.item_code)
        ) as item_code,
        MAX(sb.item_description) as item_description,
        sb.material_name,
        sb.material_type,
        MAX(sb.unit) as unit,
        MAX(sb.valuation_rate) as valuation_rate,
        MAX(sb.selling_rate) as selling_rate,
        MAX(sb.no_of_cavity) as no_of_cavity,
        MAX(sb.weight_per_unit) as weight_per_unit,
        MAX(sb.weight_uom) as weight_uom,
        MAX(sb.drawing_no) as drawing_no,
        MAX(sb.drawing_id) as drawing_id,
        MAX(sb.revision) as revision,
        MAX(sb.material_grade) as material_grade,
        MAX(sb.material_id) as material_id,
        MAX(sb.shape_id) as shape_id,
        MAX(s.name) as shape_type,
        MAX(s.name) as shape_name,
        NULL as length,
        NULL as width,
        NULL as thickness,
        NULL as diameter,
        NULL as outer_diameter,
        NULL as density,
        NULL as warehouse,
        COALESCE(MAX(sb.hsn_code), MAX(d.hsn_code)) as hsn_code,
        MAX(sb.last_updated) as last_updated,
        MAX(sb.min_stock) as min_stock,
        MAX(sb.max_stock) as max_stock,
        MAX(sb.reorder_level) as reorder_level,
        SUM(sb.current_balance) as current_balance,
        SUM(sb.current_weight) as current_weight,
        0 as accepted_qty,
        0 as issued_qty,
        0 as po_qty
      FROM stock_balance sb
      LEFT JOIN shapes s ON sb.shape_id = s.id
      LEFT JOIN (
        SELECT drawing_no, MAX(hsn_code) as hsn_code
        FROM customer_drawings
        WHERE drawing_no IS NOT NULL AND drawing_no != ''
        GROUP BY drawing_no
      ) d ON sb.drawing_no = d.drawing_no
    `;


    const conditions = [];
    if (drawingNo) {
      conditions.push(`sb.drawing_no = ?`);
      params.push(drawingNo);
    }

    if (!drawingNo) {
      conditions.push("UPPER(sb.material_type) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " GROUP BY sb.material_name, sb.material_type, sb.item_code, sb.drawing_no ORDER BY id DESC ";

    const [balances] = await pool.query(query, params);

    return balances.map(balance => ({
      id: balance.id,
      public_id: balance.public_id,
      item_code: balance.item_code,
      item_description: balance.item_description,
      material_name: balance.material_name,
      material_type: balance.material_type,
      po_qty: 0,
      received_qty: 0,
      accepted_qty: 0,
      issued_qty: 0,
      current_balance: Math.max(0, parseFloat(balance.current_balance || 0)),
      current_weight: Math.max(0, parseFloat(balance.current_weight || 0)),
      unit: balance.unit || 'NOS',
      valuation_rate: balance.valuation_rate,
      selling_rate: balance.selling_rate,
      no_of_cavity: balance.no_of_cavity,
      weight_per_unit: balance.weight_per_unit,
      weight_uom: balance.weight_uom,
      drawing_no: balance.drawing_no,
      drawing_id: balance.drawing_id,
      revision: balance.revision,
      material_grade: balance.material_grade,
      material_id: balance.material_id,
      shape_id: balance.shape_id,
      shape_type: balance.shape_type,
      shape_name: balance.shape_name,
      length: balance.length,
      width: balance.width,
      thickness: balance.thickness,
      diameter: balance.diameter,
      outer_diameter: balance.outer_diameter,
      density: balance.density,
      warehouse: balance.warehouse,
      hsn_code: balance.hsn_code,
      min_stock: parseFloat(balance.min_stock || 0),
      max_stock: parseFloat(balance.max_stock || 0),
      reorder_level: parseFloat(balance.reorder_level || 0),
      last_updated: balance.last_updated
    }));

  } else {
    // Stock Balance view: show distinct item codes (dimension-wise splits)
    let query = `
      SELECT 
        MAX(sb.id) as id,
        MAX(sb.public_id) as public_id,
        sb.item_code,
        MAX(sb.item_description) as item_description,
        MAX(sb.material_name) as material_name,
        MAX(sb.material_type) as material_type,
        MAX(sb.unit) as unit,
        MAX(sb.valuation_rate) as valuation_rate,
        MAX(sb.selling_rate) as selling_rate,
        MAX(sb.no_of_cavity) as no_of_cavity,
        MAX(sb.weight_per_unit) as weight_per_unit,
        MAX(sb.weight_uom) as weight_uom,
        MAX(sb.drawing_no) as drawing_no,
        MAX(sb.drawing_id) as drawing_id,
        MAX(sb.revision) as revision,
        MAX(sb.material_grade) as material_grade,
        MAX(sb.material_id) as material_id,
        MAX(sb.shape_id) as shape_id,
        MAX(s.name) as shape_type,
        MAX(s.name) as shape_name,
        MAX(sb.length) as length,
        MAX(sb.width) as width,
        MAX(sb.thickness) as thickness,
        MAX(sb.diameter) as diameter,
        MAX(sb.outer_diameter) as outer_diameter,
        MAX(sb.density) as density,
        MAX(sb.warehouse) as warehouse,
        COALESCE(MAX(sb.hsn_code), MAX(d.hsn_code)) as hsn_code,
        MAX(sb.last_updated) as last_updated,
        MAX(sb.min_stock) as min_stock,
        MAX(sb.max_stock) as max_stock,
        MAX(sb.reorder_level) as reorder_level,
        SUM(sb.current_balance) as current_balance,
        SUM(sb.current_weight) as current_weight,
        0 as accepted_qty,
        0 as issued_qty,
        0 as po_qty
      FROM stock_balance sb
      LEFT JOIN shapes s ON sb.shape_id = s.id
      LEFT JOIN (
        SELECT drawing_no, MAX(hsn_code) as hsn_code
        FROM customer_drawings
        WHERE drawing_no IS NOT NULL AND drawing_no != ''
        GROUP BY drawing_no
      ) d ON sb.drawing_no = d.drawing_no
    `;

    const conditions = [];
    if (drawingNo) {
      conditions.push(`sb.drawing_no = ?`);
      params.push(drawingNo);
    }

    conditions.push("UPPER(sb.material_type) NOT IN ('FG', 'FINISHED GOOD', 'FINISHED GOODS', 'FINISHED_GOODS', 'SUB_ASSEMBLY', 'SUB ASSEMBLY', 'SA', 'ASSEMBLY', 'PART')");

    conditions.push(`
      (
        UPPER(TRIM(sb.material_type)) IN ('BOUGHT_OUT', 'BOUGHT OUT', 'BOUGHT-OUT', 'BO') OR 
        sb.item_code LIKE 'BO-%' OR 
        NOT (
          (COALESCE(sb.length, 0) = 0) AND 
          (COALESCE(sb.width, 0) = 0) AND 
          (COALESCE(sb.thickness, 0) = 0) AND 
          (COALESCE(sb.diameter, 0) = 0) AND 
          (COALESCE(sb.outer_diameter, 0) = 0) AND
          EXISTS (
            SELECT 1 FROM stock_balance sb2 
            WHERE LOWER(TRIM(sb2.material_name)) = LOWER(TRIM(sb.material_name))
              AND (LOWER(TRIM(sb2.unit)) = 'kg' OR LOWER(TRIM(sb2.unit)) = 'kgs')
              AND (COALESCE(sb2.length, 0) > 0 OR COALESCE(sb2.width, 0) > 0 OR COALESCE(sb2.thickness, 0) > 0 OR COALESCE(sb2.diameter, 0) > 0 OR COALESCE(sb2.outer_diameter, 0) > 0)
          )
        )
      )
    `);

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += ` GROUP BY sb.item_code, sb.warehouse, COALESCE(sb.length, 0), COALESCE(sb.width, 0), COALESCE(sb.thickness, 0), COALESCE(sb.diameter, 0), COALESCE(sb.outer_diameter, 0) ORDER BY sb.item_code, MAX(sb.id) DESC `;

    const [balances] = await pool.query(query, params);

    return balances.map(balance => ({
      id: balance.id,
      public_id: balance.public_id,
      item_code: balance.item_code,
      item_description: balance.item_description,
      material_name: balance.material_name,
      material_type: balance.material_type,
      po_qty: parseFloat(balance.po_qty || 0),
      received_qty: parseFloat(balance.accepted_qty || 0),
      accepted_qty: parseFloat(balance.accepted_qty || 0),
      issued_qty: parseFloat(balance.issued_qty || 0),
      current_balance: Math.max(0, parseFloat(balance.current_balance || 0)),
      current_weight: Math.max(0, parseFloat(balance.current_weight || 0)),
      unit: balance.unit || 'NOS',
      valuation_rate: balance.valuation_rate,
      selling_rate: balance.selling_rate,
      no_of_cavity: balance.no_of_cavity,
      weight_per_unit: balance.weight_per_unit,
      weight_uom: balance.weight_uom,
      drawing_no: balance.drawing_no,
      drawing_id: balance.drawing_id,
      revision: balance.revision,
      material_grade: balance.material_grade,
      material_id: balance.material_id,
      shape_id: balance.shape_id,
      shape_type: balance.shape_type,
      shape_name: balance.shape_name,
      length: balance.length,
      width: balance.width,
      thickness: balance.thickness,
      diameter: balance.diameter,
      outer_diameter: balance.outer_diameter,
      density: balance.density,
      warehouse: balance.warehouse,
      hsn_code: balance.hsn_code,
      min_stock: parseFloat(balance.min_stock || 0),
      max_stock: parseFloat(balance.max_stock || 0),
      reorder_level: parseFloat(balance.reorder_level || 0),
      last_updated: balance.last_updated
    }));
  }
};

const getStockBalanceByItem = async (itemCode) => {
  const [balance] = await pool.query(`
    SELECT sb.id, sb.item_code, sb.item_description, sb.material_name, sb.material_type, sb.unit, sb.current_balance, sb.valuation_rate as avg_cost, sb.drawing_no, sb.drawing_id, 
           sb.min_stock, sb.max_stock, sb.reorder_level,
           COALESCE(sb.hsn_code, (SELECT MAX(hsn_code) FROM customer_drawings WHERE drawing_no = sb.drawing_no)) as hsn_code, sb.last_updated,
           s.name as shape_type, s.name as shape_name,
           sb.length, sb.width, sb.thickness, sb.diameter, sb.outer_diameter, sb.density, sb.weight_per_unit
    FROM stock_balance sb
    LEFT JOIN shapes s ON sb.shape_id = s.id
    WHERE sb.item_code = ?
  `, [itemCode]);

  if (balance.length === 0) {
    return null;
  }

  const details = await calculateBalanceDetailsFromLedger(itemCode);

  const [poItems] = await pool.query(`
    SELECT COALESCE(SUM(quantity), 0) as po_qty FROM purchase_order_items WHERE item_code = ?
  `, [itemCode]);

  const poQty = parseFloat(poItems[0]?.po_qty || 0);

  // Find Preferred Supplier (Vendor with highest ordered qty or who quoted)
  const [preferredSupplierRows] = await pool.query(`
    SELECT v.vendor_name 
    FROM purchase_order_items poi
    JOIN purchase_orders po ON poi.purchase_order_id = po.id
    JOIN vendors v ON po.vendor_id = v.id
    WHERE poi.item_code = ?
    GROUP BY po.vendor_id, v.vendor_name
    ORDER BY SUM(poi.quantity) DESC 
    LIMIT 1
  `, [itemCode]);

  let preferredSupplier = preferredSupplierRows[0]?.vendor_name || null;

  if (!preferredSupplier) {
    const [quotedSupplierRows] = await pool.query(`
      SELECT v.vendor_name 
      FROM quotation_items qi
      JOIN quotations q ON qi.quotation_id = q.id
      JOIN vendors v ON q.vendor_id = v.id
      WHERE qi.item_code = ?
      LIMIT 1
    `, [itemCode]);
    preferredSupplier = quotedSupplierRows[0]?.vendor_name || null;
  }

  return {
    id: balance[0].id,
    item_code: balance[0].item_code,
    item_description: balance[0].item_description,
    material_name: balance[0].material_name,
    material_type: balance[0].material_type,
    drawing_no: balance[0].drawing_no,
    drawing_id: balance[0].drawing_id,
    hsn_code: balance[0].hsn_code,
    po_qty: poQty,
    received_qty: details.received_qty,
    accepted_qty: details.accepted_qty,
    issued_qty: details.issued_qty,
    current_balance: Math.max(0, parseFloat(balance[0].current_balance || 0)),
    avg_cost: parseFloat(balance[0].avg_cost || 0),
    unit: balance[0].unit || 'NOS',
    preferred_supplier: preferredSupplier,
    min_stock: parseFloat(balance[0].min_stock || 0),
    max_stock: parseFloat(balance[0].max_stock || 0),
    reorder_level: parseFloat(balance[0].reorder_level || 0),
    last_updated: balance[0].last_updated
  };
};

const getStockBalanceByItemAndWarehouse = async (itemCode, warehouse = null, connection = null, dimensions = null) => {
  const executor = connection || pool;
  const wh = warehouse || '';
  let query = `
    SELECT * FROM stock_balance 
    WHERE item_code = ? AND (warehouse = ? OR (warehouse IS NULL AND (? IS NULL OR ? = '')))
  `;
  const params = [itemCode, wh, wh, wh];

  if (dimensions && typeof dimensions === 'object') {
    const length = parseFloat(dimensions.length || 0);
    const width = parseFloat(dimensions.width || 0);
    const thickness = parseFloat(dimensions.thickness || 0);
    const diameter = parseFloat(dimensions.diameter || 0);
    const outerDiameter = parseFloat(dimensions.outer_diameter || dimensions.outerDiameter || 0);

    query += `
      AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
      AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
      AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
      AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
      AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)
    `;
    params.push(length, width, thickness, diameter, outerDiameter);
  }

  query += ` ORDER BY current_balance DESC `;

  const [balance] = await executor.query(query, params);

  return balance.length > 0 ? balance[0] : null;
};

const addStockLedgerEntry = async (itemCode, transactionType, quantity, refDocType = null, refDocId = null, refDocNumber = null, optionsOrRemarks = {}, connectionOrUserId = null, extraOptions = {}) => {
  // Handle flexible arguments to support different calling patterns
  let options = {};
  let connection = null;
  let remarks = null;
  let userId = null;

  if (typeof optionsOrRemarks === 'string') {
    // Old pattern: (..., remarks, userId, options)
    remarks = optionsOrRemarks;
    userId = connectionOrUserId;
    options = extraOptions || {};
    connection = options.connection || null;
  } else {
    // New pattern: (..., options, connection)
    options = optionsOrRemarks || {};
    connection = connectionOrUserId;
    remarks = options.remarks || null;
    userId = options.userId || null;
  }

  const useConnection = connection || options.connection || await pool.getConnection();
  const shouldRelease = !(connection || options.connection);

  try {
    if (shouldRelease) {
      await useConnection.beginTransaction();
    }

    const warehouse = options.warehouse || null;
    const valuationRate = options.valuationRate || 0;
    const qcId = options.qcId || null;
    const grnItemId = options.grnItemId || null;

    const length = options.length !== undefined ? options.length : null;
    const width = options.width !== undefined ? options.width : null;
    const thickness = options.thickness !== undefined ? options.thickness : null;
    const diameter = options.diameter !== undefined ? options.diameter : null;
    const outerDiameter = options.outer_diameter !== undefined ? options.outer_diameter : (options.outerDiameter !== undefined ? options.outerDiameter : null);
    const density = options.density !== undefined ? options.density : null;

    const dimsObj = { length, width, thickness, diameter, outer_diameter: outerDiameter, density };

    // Get existing balance for this item, warehouse and dimensions
    let existingBalance = await getStockBalanceByItemAndWarehouse(itemCode, warehouse, useConnection, dimsObj);

    // If not found for this specific warehouse, check if any balance entry exists for this item_code with matching dimensions
    if (!existingBalance) {
      const lenVal = parseFloat(length || 0);
      const widVal = parseFloat(width || 0);
      const thkVal = parseFloat(thickness || 0);
      const diaVal = parseFloat(diameter || 0);
      const odiaVal = parseFloat(outerDiameter || 0);

      const [anyBalance] = await useConnection.query(
        `SELECT * FROM stock_balance 
         WHERE item_code = ? 
           AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
           AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
           AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
           AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
           AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)
         ORDER BY current_balance DESC LIMIT 1`,
        [itemCode, lenVal, widVal, thkVal, diaVal, odiaVal]
      );
      if (anyBalance.length > 0) {
        existingBalance = anyBalance[0];
        if (parseFloat(existingBalance.current_balance) === 0 && warehouse) {
          await useConnection.execute(
            'UPDATE stock_balance SET warehouse = ? WHERE id = ?',
            [warehouse, existingBalance.id]
          );
        }
      }
    }

    let currentBalance = existingBalance ? parseFloat(existingBalance.current_balance) || 0 : 0;
    let newBalance = 0;
    const qty = parseFloat(quantity) || 0;

    // Validation to prevent negative stock
    if (transactionType === 'OUT' || ((transactionType === 'ADJUSTMENT' || transactionType === 'RETURN') && qty < 0)) {
      const deductionQty = Math.abs(qty);
      if (currentBalance + 0.0001 < deductionQty) {
        throw new Error(`Insufficient stock. Available Qty: ${currentBalance}. Negative stock is not allowed.`);
      }
    }

    if (transactionType === 'IN' || transactionType === 'GRN_IN') {
      newBalance = currentBalance + qty;
    } else if (transactionType === 'OUT') {
      newBalance = currentBalance - qty;
    } else if (transactionType === 'ADJUSTMENT' || transactionType === 'RETURN') {
      newBalance = currentBalance + qty;
    } else {
      newBalance = currentBalance;
    }

    let matName = options.materialName || existingBalance?.material_name || null;
    let matType = options.materialType || existingBalance?.material_type || null;

    if (!matType && itemCode && String(itemCode).toUpperCase().startsWith('BO-')) {
      matType = 'BOUGHT_OUT';
    }

    // Normalize materialType to UPPER_CASE_WITH_UNDERSCORE
    if (matType) {
      matType = matType.toUpperCase().trim().replace(/ /g, '_');
    }

    // Try to fetch name if still null
    if (!matName) {
      const [nameRows] = await useConnection.query(`
        SELECT material_name, material_type 
        FROM stock_balance 
        WHERE item_code = ? AND material_name IS NOT NULL 
        LIMIT 1
      `, [itemCode]);

      if (nameRows.length > 0) {
        matName = nameRows[0].material_name;
        matType = nameRows[0].material_type;
      } else {
        const [poRows] = await useConnection.query(`
          SELECT material_name, material_type 
          FROM purchase_order_items 
          WHERE item_code = ? AND material_name IS NOT NULL 
          LIMIT 1
        `, [itemCode]);

        if (poRows.length > 0) {
          matName = poRows[0].material_name;
          matType = poRows[0].material_type;
        }
      }
    }

    let qtyIn = 0;
    let qtyOut = 0;
    const weight = parseFloat(options.weight || 0);
    let weightIn = 0;
    let weightOut = 0;

    if (transactionType === 'IN' || transactionType === 'GRN_IN' || transactionType === 'ADJUSTMENT') {
      if (qty >= 0) { qtyIn = Math.abs(qty); weightIn = Math.abs(weight); }
      else { qtyOut = Math.abs(qty); weightOut = Math.abs(weight); }
    } else if (transactionType === 'OUT') {
      qtyOut = Math.abs(qty);
      weightOut = Math.abs(weight);
    } else if (transactionType === 'RETURN') {
      qtyIn = Math.abs(qty);
      weightIn = Math.abs(weight);
    }

    // Insert into stock_ledger
    await useConnection.execute(`
      INSERT INTO stock_ledger 
      (item_code, material_name, material_type, transaction_type, transaction_date, quantity, qty_in, qty_out, weight_in, weight_out, weight_after, reference_doc_type, reference_doc_id, reference_doc_number, balance_after, remarks, created_by, warehouse, valuation_rate, qc_id, grn_item_id, length, width, thickness, diameter, outer_diameter, density)
      VALUES (?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [itemCode, matName, matType, transactionType, quantity, qtyIn, qtyOut, weightIn, weightOut, refDocType, refDocId, refDocNumber, 0, remarks, userId, warehouse, valuationRate, qcId, grnItemId, length, width, thickness, diameter, outerDiameter, density]);

    const ledgerId = (await useConnection.query('SELECT LAST_INSERT_ID() as id'))[0][0].id;

    // Recalculate balances for accuracy
    const globalDetails = await calculateBalanceDetailsFromLedger(itemCode, 'ALL', useConnection, dimsObj);
    const globalBalance = globalDetails.current_balance;
    const globalWeight = globalDetails.current_weight;

    let warehouseBalance = globalBalance;
    let warehouseWeight = globalWeight;
    if (warehouse && warehouse !== 'ALL') {
      const whDetails = await calculateBalanceDetailsFromLedger(itemCode, warehouse, useConnection, dimsObj);
      warehouseBalance = whDetails.current_balance;
      warehouseWeight = whDetails.current_weight;
    }

    // Update the ledger entry with the correct global balance_after and weight_after
    await useConnection.execute('UPDATE stock_ledger SET balance_after = ?, weight_after = ? WHERE id = ?', [globalBalance, globalWeight, ledgerId]);

    // Ensure we have a warehouse string for the query
    const whName = warehouse || '';

    const weightPerUnit = options.weight_per_unit !== undefined ? options.weight_per_unit : (options.weightPerUnit !== undefined ? options.weightPerUnit : (existingBalance?.weight_per_unit || null));
    let shapeId = options.shape_id !== undefined ? options.shape_id : (options.shapeId !== undefined ? options.shapeId : (existingBalance?.shape_id || null));
    if (!shapeId && (options.shape_type || options.shapeType)) {
      const shapeName = options.shape_type || options.shapeType;
      const [shapeRows] = await useConnection.query(
        'SELECT id FROM shapes WHERE name = ? LIMIT 1',
        [shapeName]
      );
      if (shapeRows.length > 0) {
        shapeId = shapeRows[0].id;
      }
    }
    const materialId = options.material_id !== undefined ? options.material_id : (options.materialId !== undefined ? options.materialId : (existingBalance?.material_id || null));

    if (existingBalance) {
      await useConnection.execute(`
        UPDATE stock_balance SET 
          current_balance = ?,
          current_weight = ?,
          material_name = COALESCE(?, material_name),
          material_type = COALESCE(?, material_type),
          valuation_rate = CASE WHEN ? > 0 THEN ? ELSE valuation_rate END,
          length = COALESCE(?, length),
          width = COALESCE(?, width),
          thickness = COALESCE(?, thickness),
          diameter = COALESCE(?, diameter),
          outer_diameter = COALESCE(?, outer_diameter),
          density = COALESCE(?, density),
          weight_per_unit = COALESCE(?, weight_per_unit),
          shape_id = COALESCE(?, shape_id),
          material_id = COALESCE(?, material_id),
          last_updated = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        warehouseBalance,
        warehouseWeight,
        matName,
        matType,
        valuationRate,
        valuationRate,
        length,
        width,
        thickness,
        diameter,
        outerDiameter,
        density,
        weightPerUnit,
        shapeId,
        materialId,
        existingBalance.id
      ]);
    } else {
      await useConnection.execute(`
        INSERT INTO stock_balance 
        (item_code, material_name, material_type, warehouse, unit, current_balance, current_weight, valuation_rate, item_description,
         length, width, thickness, diameter, outer_diameter, density, weight_per_unit, shape_id, material_id, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        itemCode,
        matName,
        matType,
        whName,
        options.unit || 'NOS',
        warehouseBalance,
        warehouseWeight,
        valuationRate,
        options.remarks || options.description || null,
        length,
        width,
        thickness,
        diameter,
        outerDiameter,
        density,
        weightPerUnit,
        shapeId,
        materialId
      ]);
    }

    if (shouldRelease) {
      await useConnection.commit();
    }
    return { success: true };
  } catch (error) {
    if (shouldRelease) {
      await useConnection.rollback();
    }
    throw error;
  } finally {
    if (shouldRelease) {
      useConnection.release();
    }
  }
};

const createQCStockLedgerEntry = async (qcId, grnId, grnItemId, itemCode, passQty, connection = null, passWeight = 0) => {
  const useConnection = connection || (await pool.getConnection());

  try {
    if (!connection) {
      await useConnection.beginTransaction();
    }

    console.log(`[Stock] Creating entry for QC:${qcId}, GRN:${grnId}, Item:${itemCode}, Qty:${passQty}`);

    // Fetch dimension details from GRN/PO item
    let itemDims = {};
    if (grnItemId) {
      const [dimRows] = await useConnection.query(`
        SELECT 
          COALESCE(NULLIF(gi.length, 0), NULLIF(poi.length, 0)) as length,
          COALESCE(NULLIF(gi.width, 0), NULLIF(poi.width, 0)) as width,
          COALESCE(NULLIF(gi.thickness, 0), NULLIF(poi.thickness, 0)) as thickness,
          COALESCE(NULLIF(gi.diameter, 0), NULLIF(poi.diameter, 0)) as diameter,
          COALESCE(NULLIF(gi.outer_diameter, 0), NULLIF(poi.outer_diameter, 0)) as outer_diameter,
          COALESCE(NULLIF(gi.density, 0), NULLIF(poi.density, 0)) as density,
          COALESCE(NULLIF(gi.weight_per_unit, 0), NULLIF(poi.weight_per_unit, 0)) as weight_per_unit,
          poi.shape_type as shape_type,
          poi.material_name as material_name,
          poi.material_type as material_type
        FROM grn_items gi
        LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
        WHERE gi.id = ?
        LIMIT 1
      `, [grnItemId]);
      if (dimRows.length > 0) itemDims = dimRows[0];
    }

    // Duplicate check
    const [existing] = await useConnection.query(
      `SELECT id FROM stock_ledger 
       WHERE reference_doc_id = ? 
       AND grn_item_id = ? 
       AND transaction_type = 'IN'`,
      [grnId, grnItemId]
    );

    if (existing.length > 0) {
      console.log(`[Stock] Duplicate found - skipping`);
      if (!connection) {
        await useConnection.commit();
        useConnection.release();
      }
      return { success: true, duplicate: true };
    }

    // Use addStockLedgerEntry for consistency and to ensure qty_in/qty_out/weight_in/weight_out are set
    await addStockLedgerEntry(
      itemCode,
      'IN',
      passQty,
      'GRN',
      grnId,
      `GRN-${String(grnId).padStart(4, '0')}`,
      'Auto-created from QC Pass',
      null,
      {
        connection: useConnection,
        qcId: qcId,
        grnItemId: grnItemId,
        warehouse: 'RM-HOLD', // Default warehouse for GRN Receipt as per warehouseAllocationService
        weight: parseFloat(passWeight) || 0,
        length: itemDims.length !== null && itemDims.length !== undefined ? parseFloat(itemDims.length) : undefined,
        width: itemDims.width !== null && itemDims.width !== undefined ? parseFloat(itemDims.width) : undefined,
        thickness: itemDims.thickness !== null && itemDims.thickness !== undefined ? parseFloat(itemDims.thickness) : undefined,
        diameter: itemDims.diameter !== null && itemDims.diameter !== undefined ? parseFloat(itemDims.diameter) : undefined,
        outer_diameter: itemDims.outer_diameter !== null && itemDims.outer_diameter !== undefined ? parseFloat(itemDims.outer_diameter) : undefined,
        density: itemDims.density !== null && itemDims.density !== undefined ? parseFloat(itemDims.density) : undefined,
        weight_per_unit: itemDims.weight_per_unit !== null && itemDims.weight_per_unit !== undefined ? parseFloat(itemDims.weight_per_unit) : undefined,
        shape_type: itemDims.shape_type || undefined,
        materialName: itemDims.material_name || undefined,
        materialType: itemDims.material_type || undefined
      }
    );

    if (!connection) {
      await useConnection.commit();
      useConnection.release();
    }

    return { success: true, duplicate: false };
  } catch (error) {
    console.error(`[Stock] Error:`, error.message);
    if (!connection) {
      await useConnection.rollback();
      useConnection.release();
    }
    throw error;
  }
};

const updateStockBalance = async (itemCode, poQty = null, receivedQty = null, acceptedQty = null, issuedQty = null, itemDescription = null, unit = null, materialName = null, materialType = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await getStockBalanceByItem(itemCode);

    const setClauses = [];
    const params = [];

    if (poQty !== null && poQty !== undefined) {
      setClauses.push('po_qty = ?');
      params.push(poQty);
    }

    if (receivedQty !== null && receivedQty !== undefined) {
      setClauses.push('received_qty = ?');
      params.push(receivedQty);
    }

    if (acceptedQty !== null && acceptedQty !== undefined) {
      setClauses.push('accepted_qty = ?');
      params.push(acceptedQty);
    }

    if (issuedQty !== null && issuedQty !== undefined) {
      setClauses.push('issued_qty = ?');
      params.push(issuedQty);
    }

    if (itemDescription !== null && itemDescription !== undefined) {
      setClauses.push('item_description = ?');
      params.push(itemDescription);
    }

    if (unit !== null && unit !== undefined) {
      setClauses.push('unit = ?');
      params.push(unit);
    }

    if (materialName !== null && materialName !== undefined) {
      setClauses.push('material_name = ?');
      params.push(materialName);
    }

    if (materialType !== null && materialType !== undefined) {
      setClauses.push('material_type = ?');
      const normalizedType = materialType.toUpperCase().trim().replace(/ /g, '_');
      params.push(normalizedType);
    }

    if (existing) {
      if (setClauses.length > 0) {
        setClauses.push('last_updated = CURRENT_TIMESTAMP');
        params.push(itemCode);
        await connection.execute(
          `UPDATE stock_balance SET ${setClauses.join(', ')} WHERE item_code = ?`,
          params
        );
      }
    } else {
      const normalizedType = (materialType || '').toUpperCase().trim().replace(/ /g, '_');
      await connection.execute(`
        INSERT INTO stock_balance (item_code, item_description, unit, po_qty, received_qty, accepted_qty, issued_qty, material_name, material_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        itemCode,
        itemDescription || null,
        unit || 'NOS',
        poQty || 0,
        receivedQty || 0,
        acceptedQty || 0,
        issuedQty || 0,
        materialName || null,
        normalizedType || null
      ]);
    }

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const generateItemCode = async (itemName, itemGroup) => {
  let prefix = 'ITM';

  // Try to find the actual group_type from the item_groups table first
  const [groupRows] = await pool.query(
    'SELECT group_type FROM item_groups WHERE name = ? OR id = ? LIMIT 1',
    [itemGroup, itemGroup]
  );

  let groupType = itemGroup;
  if (groupRows.length > 0) {
    groupType = groupRows[0].group_type;
  }

  const group = (groupType || '').toUpperCase().trim();

  if (group.includes('FINISHED') || group === 'FG' || group.includes('PART')) {
    prefix = 'PART';
  } else if (group.includes('RAW') || group === 'RM') {
    prefix = 'RAW';
  } else if (group.includes('BOUGHT') || group.includes('BO') || group.includes('OUT')) {
    prefix = 'BO';
  } else if (group.includes('CONSUM') || group === 'CON' || group.includes('CONSUMBLE')) {
    prefix = 'CON';
  } else if (group.includes('SEMI') || group === 'SFG') {
    prefix = 'SFG';
  } else if (group.includes('ASSEMBL') || group === 'SA' || group === 'ASSY') {
    prefix = 'ASSEMBLY';
  } else if (group.includes('PACK') || group === 'PAC') {
    prefix = 'PAC';
  } else if (group.includes('SERV') || group === 'SER') {
    prefix = 'SER';
  } else if (group.includes('OTH')) {
    prefix = 'OTH';
  } else if (group) {
    prefix = group.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
  }

  // Clean item name for inclusion in code (alphanumeric only, max 15 chars)
  const cleanName = itemName ? itemName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toUpperCase() : 'ITEM';
  const baseCode = `${prefix}-${cleanName}`;

  // Find the highest sequence number for this base code across stock_balance, sales_order_items, and items tables
  const [rows] = await pool.query(
    `SELECT item_code FROM stock_balance WHERE item_code LIKE ?
     UNION
     SELECT item_code FROM sales_order_items WHERE item_code LIKE ?
     UNION
     SELECT item_code FROM items WHERE item_code LIKE ?`,
    [`${baseCode}-%`, `${baseCode}-%`, `${baseCode}-%`]
  );

  let nextNumber = 1;
  let maxSeq = 0;
  for (const row of rows) {
    const code = row.item_code;
    if (code) {
      const parts = code.split('-');
      const numStr = parts[parts.length - 1];
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }
  nextNumber = maxSeq + 1;

  return `${baseCode}-${String(nextNumber).padStart(4, '0')}`;
};

const createItem = async (itemData) => {
  console.log('createItem called with:', itemData);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let itemCode = itemData.itemCode;
    if (!itemCode || itemCode.toLowerCase() === 'auto-generated' || itemCode === '') {
      itemCode = await generateItemCode(itemData.itemName, itemData.itemGroup);
    }

    const [existing] = await connection.query(
      'SELECT id FROM stock_balance WHERE item_code = ?',
      [itemCode]
    );

    if (existing.length > 0) {
      const error = new Error('Item code already exists');
      error.statusCode = 400;
      throw error;
    }

    const cleanDwg = (itemData.drawingNo || '').trim();
    if (cleanDwg && cleanDwg !== '—' && cleanDwg.toUpperCase() !== 'N/A' && cleanDwg.toUpperCase() !== 'NA') {
      const [existingDwg] = await connection.query(
        'SELECT id FROM stock_balance WHERE UPPER(TRIM(drawing_no)) = UPPER(TRIM(?)) LIMIT 1',
        [cleanDwg]
      );
      if (existingDwg.length > 0) {
        const error = new Error('Drawing Number already exists in Items Master.');
        error.statusCode = 400;
        throw error;
      }
    }

    const normalizedGroup = (itemData.itemGroup || '').toUpperCase().trim().replace(/ /g, '_');

    await connection.execute(`
      INSERT INTO stock_balance (
        item_code, material_name, material_type, unit, 
        valuation_rate, selling_rate, no_of_cavity, 
        weight_per_unit, weight_uom, drawing_no, 
        revision, material_grade,
        material_id, shape_id, length, width, thickness, 
        diameter, outer_diameter, density, hsn_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      itemCode,
      itemData.itemName,
      normalizedGroup,
      itemData.defaultUom || 'Nos',
      itemData.valuationRate || 0,
      itemData.sellingRate || 0,
      itemData.noOfCavity || 1,
      itemData.weightPerUnit || 0,
      itemData.weightUom || null,
      itemData.drawingNo || null,
      itemData.revision || null,
      itemData.materialGrade || null,
      itemData.materialId || null,
      itemData.shapeId || null,
      itemData.length || null,
      itemData.width || null,
      itemData.thickness || null,
      itemData.diameter || null,
      itemData.outerDiameter || null,
      itemData.density || null,
      itemData.hsnCode || null
    ]);

    await connection.commit();
    return { success: true, itemCode };
  } catch (error) {
    console.error('Error in createItem:', error);
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateItem = async (id, itemData) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const cleanDwg = (itemData.drawingNo || '').trim();
    if (cleanDwg && cleanDwg !== '—' && cleanDwg.toUpperCase() !== 'N/A' && cleanDwg.toUpperCase() !== 'NA') {
      const [existingDwg] = await connection.query(
        'SELECT id FROM stock_balance WHERE UPPER(TRIM(drawing_no)) = UPPER(TRIM(?)) AND id != ? LIMIT 1',
        [cleanDwg, id]
      );
      if (existingDwg.length > 0) {
        const error = new Error('Drawing Number already exists in Items Master.');
        error.statusCode = 400;
        throw error;
      }
    }

    const normalizedGroup = (itemData.itemGroup || '').toUpperCase().trim().replace(/ /g, '_');

    await connection.execute(`
      UPDATE stock_balance SET
        item_code = ?, material_name = ?, material_type = ?, unit = ?, 
        valuation_rate = ?, selling_rate = ?, no_of_cavity = ?, 
        weight_per_unit = ?, weight_uom = ?, drawing_no = ?, 
        revision = ?, material_grade = ?,
        material_id = ?, shape_id = ?, length = ?, width = ?, thickness = ?, 
        diameter = ?, outer_diameter = ?, density = ?, hsn_code = ?,
        last_updated = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      itemData.itemCode,
      itemData.itemName,
      normalizedGroup,
      itemData.defaultUom || 'Nos',
      itemData.valuationRate || 0,
      itemData.sellingRate || 0,
      itemData.noOfCavity || 1,
      itemData.weightPerUnit || 0,
      itemData.weightUom || null,
      itemData.drawingNo || null,
      itemData.revision || null,
      itemData.materialGrade || null,
      itemData.materialId || null,
      itemData.shapeId || null,
      itemData.length || null,
      itemData.width || null,
      itemData.thickness || null,
      itemData.diameter || null,
      itemData.outerDiameter || null,
      itemData.density || null,
      itemData.hsnCode || null,
      id
    ]);

    // Sync across all modules for this drawing_no
    if (itemData.drawingNo) {
      const rawGroup = (itemData.itemGroup || '').toLowerCase().trim();
      const isAssembly = rawGroup.includes('assembly');
      const targetType = isAssembly ? 'Assembly' : (rawGroup.includes('part') ? 'Part' : rawGroup.toUpperCase());
      const targetGroup = rawGroup;

      // Update customer_drawings
      await connection.execute(
        'UPDATE customer_drawings SET drawing_type = ?, updated_at = NOW() WHERE drawing_no = ?',
        [targetType, itemData.drawingNo]
      );

      // Update sales_order_items
      await connection.execute(
        'UPDATE sales_order_items SET drawing_type = ?, item_type = ?, item_group = ?, item_code = ? WHERE drawing_no = ? OR drawing_id IN (SELECT id FROM customer_drawings WHERE drawing_no = ?)',
        [targetType, targetType, targetGroup, itemData.itemCode, itemData.drawingNo, itemData.drawingNo]
      );

      // Update bom
      await connection.execute(
        'UPDATE bom SET item_group = ?, item_code = ? WHERE drawing_no = ?',
        [targetGroup, itemData.itemCode, itemData.drawingNo]
      );
    }

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const promoteDrawingToItem = async (drawingData, connection = null) => {
  const { drawing_no, description, drawing_type, revision_no, unit } = drawingData;
  const useConnection = connection || await pool.getConnection();
  const shouldRelease = !connection;

  try {
    if (shouldRelease) await useConnection.beginTransaction();

    // Check if item already exists for this drawing_no
    const [existing] = await useConnection.query(
      'SELECT item_code FROM stock_balance WHERE UPPER(TRIM(drawing_no)) = UPPER(TRIM(?)) LIMIT 1',
      [drawing_no]
    );

    if (existing.length > 0) {
      if (shouldRelease) await useConnection.commit();
      return existing[0].item_code;
    }

    // Generate item code - Map drawing types to item group types for prefixing
    let itemGroup = drawing_type;
    if (drawing_type?.toUpperCase() === 'ASSEMBLY') itemGroup = 'ASSEMBLY';
    else if (drawing_type?.toUpperCase() === 'PART') itemGroup = 'PART';

    const itemCode = await generateItemCode(description, itemGroup);
    const normalizedGroup = (itemGroup || 'PART').toUpperCase().trim().replace(/ /g, '_');

    await useConnection.execute(`
      INSERT INTO stock_balance (
        item_code, material_name, material_type, unit, 
        drawing_no, revision
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      itemCode,
      description || 'Drawing Item',
      normalizedGroup,
      unit || 'NOS',
      drawing_no,
      revision_no || '0'
    ]);

    if (shouldRelease) await useConnection.commit();
    return itemCode;
  } catch (error) {
    if (shouldRelease) await useConnection.rollback();
    throw error;
  } finally {
    if (shouldRelease) useConnection.release();
  }
};

const deleteItem = async (id) => {
  const [result] = await pool.execute('DELETE FROM stock_balance WHERE id = ?', [id]);
  if (result.affectedRows === 0) {
    const error = new Error('Item not found');
    error.statusCode = 404;
    throw error;
  }
  return { success: true };
};

module.exports = {
  getStockLedger,
  getStockBalance,
  getStockBalanceByItem,
  addStockLedgerEntry,
  updateStockBalance,
  createQCStockLedgerEntry,
  deleteStockLedgerEntry,
  deleteStockBalance,
  createItem,
  updateItem,
  promoteDrawingToItem,
  generateItemCode
};
