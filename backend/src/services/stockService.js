const pool = require('../config/db');

const calculateBalanceDetailsFromLedger = async (itemCode, warehouse = null, connection = null) => {
  const executor = connection || pool;
  let query = `
    SELECT 
      SUM(qty_in) as accepted_qty,
      SUM(qty_out) as issued_qty,
      SUM(qty_in - qty_out) as current_balance
    FROM stock_ledger 
    WHERE item_code = ?
  `;
  
  const params = [itemCode];
  if (warehouse && warehouse !== 'ALL') {
    query += ` AND warehouse = ? `;
    params.push(warehouse);
  } else if (warehouse === null) {
    query += ` AND (warehouse IS NULL OR warehouse = '') `;
  }
  // If warehouse === 'ALL', no additional filter is added

  const [ledgerData] = await executor.query(query, params);

  const ledger = ledgerData[0] || {};
  return {
    received_qty: parseFloat(ledger.accepted_qty) || 0,
    accepted_qty: parseFloat(ledger.accepted_qty) || 0,
    issued_qty: parseFloat(ledger.issued_qty) || 0,
    current_balance: parseFloat(ledger.current_balance) || 0
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
      SET current_balance = ?, last_updated = CURRENT_TIMESTAMP
      WHERE item_code = ? AND (warehouse = ? OR (warehouse IS NULL AND ? IS NULL))
    `, [details.current_balance, item_code, warehouse, warehouse]);

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
  const [result] = await pool.execute('DELETE FROM stock_balance WHERE id = ?', [id]);
  if (result.affectedRows === 0) {
    const error = new Error('Stock balance not found');
    error.statusCode = 404;
    throw error;
  }
  return { success: true };
};

const getStockLedger = async (itemCode = null, startDate = null, endDate = null) => {
  let query = `SELECT 
    id,
    item_code,
    material_name,
    material_type,
    transaction_date,
    transaction_type,
    quantity,
    reference_doc_type,
    reference_doc_id,
    reference_doc_number,
    qc_id,
    grn_item_id,
    balance_after,
    remarks,
    created_at
  FROM stock_ledger`;

  const conditions = [];
  const params = [];

  if (itemCode) {
    conditions.push('item_code = ?');
    params.push(itemCode);
  }

  if (startDate) {
    conditions.push('transaction_date >= ?');
    params.push(startDate);
  }

  if (endDate) {
    conditions.push('transaction_date <= ?');
    params.push(endDate);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY transaction_date DESC';

  const [ledger] = await pool.query(query, params);
  return ledger;
};

const getStockBalance = async (drawingNo = null) => {
  let query = `
    SELECT 
      MIN(id) as id,
      item_code,
      MAX(item_description) as item_description,
      MAX(material_name) as material_name,
      MAX(material_type) as material_type,
      MAX(unit) as unit,
      MAX(valuation_rate) as valuation_rate,
      MAX(selling_rate) as selling_rate,
      MAX(no_of_cavity) as no_of_cavity,
      MAX(weight_per_unit) as weight_per_unit,
      MAX(weight_uom) as weight_uom,
      MAX(drawing_no) as drawing_no,
      MAX(drawing_id) as drawing_id,
      MAX(revision) as revision,
      MAX(material_grade) as material_grade,
      MAX(warehouse) as warehouse,
      MAX(last_updated) as last_updated,
      SUM(current_balance) as current_balance
    FROM stock_balance
  `;

  const params = [];
  if (drawingNo) {
    query += ` WHERE drawing_no = ? `;
    params.push(drawingNo);
  }

  query += ` GROUP BY item_code ORDER BY id DESC `;

  const [balances] = await pool.query(query, params);

  const result = [];
  for (const balance of balances) {
    // For consolidated view, we calculate totals from ledger across ALL warehouses
    const details = await calculateBalanceDetailsFromLedger(balance.item_code, 'ALL');
    
    const [poItems] = await pool.query(`
      SELECT COALESCE(SUM(quantity), 0) as po_qty FROM purchase_order_items WHERE item_code = ?
    `, [balance.item_code]);
    
    const poQty = parseFloat(poItems[0]?.po_qty || 0);
    
    result.push({
      id: balance.id,
      item_code: balance.item_code,
      item_description: balance.item_description,
      material_name: balance.material_name,
      material_type: balance.material_type,
      po_qty: poQty,
      received_qty: details.received_qty,
      accepted_qty: details.accepted_qty,
      issued_qty: details.issued_qty,
      current_balance: details.current_balance,
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
      warehouse: balance.warehouse,
      last_updated: balance.last_updated
    });
  }

  return result;
};

const getStockBalanceByItem = async (itemCode) => {
  const [balance] = await pool.query(`
    SELECT id, item_code, item_description, material_name, material_type, unit, drawing_no, drawing_id, last_updated FROM stock_balance WHERE item_code = ?
  `, [itemCode]);

  if (balance.length === 0) {
    return null;
  }

  const details = await calculateBalanceDetailsFromLedger(itemCode);

  const [poItems] = await pool.query(`
    SELECT COALESCE(SUM(quantity), 0) as po_qty FROM purchase_order_items WHERE item_code = ?
  `, [itemCode]);
  
  const poQty = parseFloat(poItems[0]?.po_qty || 0);

  return {
    id: balance[0].id,
    item_code: balance[0].item_code,
    item_description: balance[0].item_description,
    material_name: balance[0].material_name,
    material_type: balance[0].material_type,
    drawing_no: balance[0].drawing_no,
    drawing_id: balance[0].drawing_id,
    po_qty: poQty,
    received_qty: details.received_qty,
    accepted_qty: details.accepted_qty,
    issued_qty: details.issued_qty,
    current_balance: details.current_balance,
    unit: balance[0].unit || 'NOS',
    last_updated: balance[0].last_updated
  };
};

const getStockBalanceByItemAndWarehouse = async (itemCode, warehouse = null, connection = null) => {
  const executor = connection || pool;
  const [balance] = await executor.query(`
    SELECT * FROM stock_balance 
    WHERE item_code = ? AND (warehouse = ? OR (warehouse IS NULL AND ? IS NULL))
  `, [itemCode, warehouse, warehouse]);

  return balance.length > 0 ? balance[0] : null;
};

const addStockLedgerEntry = async (itemCode, transactionType, quantity, refDocType = null, refDocId = null, refDocNumber = null, remarks = null, userId = null, options = {}) => {
  const connection = options.connection || await pool.getConnection();
  const shouldRelease = !options.connection;
  
  try {
    if (shouldRelease) {
      await connection.beginTransaction();
    }

    const warehouse = options.warehouse || null;
    const valuationRate = options.valuationRate || 0;
    const qcId = options.qcId || null;
    const grnItemId = options.grnItemId || null;
    
    // Get existing balance for this item and warehouse
    let existingBalance = await getStockBalanceByItemAndWarehouse(itemCode, warehouse, connection);

    // If not found for this specific warehouse, try to find the "master" entry (usually the one without a warehouse or the first one)
    // to inherit material details correctly and prevent duplicates in UI if the UI doesn't filter by warehouse
    if (!existingBalance) {
      const [masterRows] = await connection.query(
        'SELECT * FROM stock_balance WHERE item_code = ? LIMIT 1',
        [itemCode]
      );
      if (masterRows.length > 0) {
        // We use the master details but we STILL want to create/update a specific warehouse record if 'warehouse' is provided
        const master = masterRows[0];
        if (!options.materialName) options.materialName = master.material_name;
        if (!options.materialType) options.materialType = master.material_type;
        if (!options.drawingNo) options.drawingNo = master.drawing_no;
        if (!options.drawingId) options.drawingId = master.drawing_id;
        if (!options.unit) options.unit = master.unit;
      }
    }

    let currentBalance = existingBalance ? parseFloat(existingBalance.current_balance) || 0 : 0;
    let newBalance = 0;
    const qty = parseFloat(quantity) || 0;

    if (transactionType === 'IN' || transactionType === 'GRN_IN') {
      newBalance = currentBalance + qty;
    } else if (transactionType === 'OUT') {
      newBalance = Math.max(0, currentBalance - qty);
    } else if (transactionType === 'ADJUSTMENT' || transactionType === 'RETURN') {
      newBalance = currentBalance + qty;
    } else {
      newBalance = currentBalance;
    }

    let matName = options.materialName || existingBalance?.material_name || null;
    let matType = options.materialType || existingBalance?.material_type || null;
    let drawingNo = options.drawingNo || existingBalance?.drawing_no || null;
    let drawingId = options.drawingId || existingBalance?.drawing_id || null;

    // Try to fetch name if still null
    if (!matName) {
      const [nameRows] = await connection.query(`
        SELECT material_name, material_type, drawing_no, drawing_id 
        FROM stock_balance 
        WHERE item_code = ? AND material_name IS NOT NULL 
        LIMIT 1
      `, [itemCode]);
      
      if (nameRows.length > 0) {
        matName = nameRows[0].material_name;
        matType = nameRows[0].material_type;
        drawingNo = drawingNo || nameRows[0].drawing_no;
        drawingId = drawingId || nameRows[0].drawing_id;
      } else {
        const [poRows] = await connection.query(`
          SELECT material_name, material_type, drawing_no, drawing_id 
          FROM purchase_order_items 
          WHERE item_code = ? AND material_name IS NOT NULL 
          LIMIT 1
        `, [itemCode]);

        if (poRows.length > 0) {
          matName = poRows[0].material_name;
          matType = poRows[0].material_type;
          drawingNo = drawingNo || poRows[0].drawing_no;
          drawingId = drawingId || poRows[0].drawing_id;
        }
      }
    }

    let qtyIn = 0;
    let qtyOut = 0;

    if (transactionType === 'IN' || transactionType === 'GRN_IN' || transactionType === 'ADJUSTMENT') {
      if (qty >= 0) qtyIn = Math.abs(qty);
      else qtyOut = Math.abs(qty);
    } else if (transactionType === 'OUT') {
      qtyOut = Math.abs(qty);
    } else if (transactionType === 'RETURN') {
      qtyIn = Math.abs(qty);
    }

    // Insert into stock_ledger
    await connection.execute(`
      INSERT INTO stock_ledger 
      (item_code, material_name, material_type, drawing_no, drawing_id, transaction_type, quantity, qty_in, qty_out, reference_doc_type, reference_doc_id, reference_doc_number, balance_after, remarks, created_by, warehouse, valuation_rate, qc_id, grn_item_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [itemCode, matName, matType, drawingNo, drawingId, transactionType, quantity, qtyIn, qtyOut, refDocType, refDocId, refDocNumber, 0, remarks, userId, warehouse, valuationRate, qcId, grnItemId]);

    const ledgerId = (await connection.query('SELECT LAST_INSERT_ID() as id'))[0][0].id;

    // Recalculate balance from ledger for accuracy (consolidated)
    const details = await calculateBalanceDetailsFromLedger(itemCode, 'ALL', connection);
    newBalance = details.current_balance;

    // Update the ledger entry with the correct balance_after
    await connection.execute('UPDATE stock_ledger SET balance_after = ? WHERE id = ?', [newBalance, ledgerId]);

    // IMPORTANT: Update or insert into stock_balance
    // We always want to update the "Master" record if it exists, or the specific warehouse one.
    // To prevent duplicates in UI, we check for ANY existing balance for this item first if specific one doesn't exist.
    let balanceToUpdate = existingBalance;
    if (!balanceToUpdate) {
      const [anyBalance] = await connection.query('SELECT * FROM stock_balance WHERE item_code = ? LIMIT 1', [itemCode]);
      if (anyBalance.length > 0) balanceToUpdate = anyBalance[0];
    }

    if (balanceToUpdate) {
      await connection.execute(`
        UPDATE stock_balance 
        SET current_balance = current_balance + ?, 
            material_name = COALESCE(?, material_name), 
            material_type = COALESCE(?, material_type), 
            drawing_no = COALESCE(?, drawing_no), 
            drawing_id = COALESCE(?, drawing_id), 
            last_updated = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [qtyIn - qtyOut, matName, matType, drawingNo, drawingId, balanceToUpdate.id]);
    } else {
      await connection.execute(`
        INSERT INTO stock_balance 
        (item_code, current_balance, material_name, material_type, drawing_no, drawing_id, warehouse, unit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [itemCode, qtyIn - qtyOut, matName, matType, drawingNo, drawingId, warehouse, options.unit || 'NOS']);
    }

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

const createQCStockLedgerEntry = async (qcId, grnId, grnItemId, itemCode, passQty, connection = null) => {
  const useConnection = connection || (await pool.getConnection());
  
  try {
    if (!connection) {
      await useConnection.beginTransaction();
    }

    console.log(`[Stock] Creating entry for QC:${qcId}, GRN:${grnId}, Item:${itemCode}, Qty:${passQty}`);

    // Duplicate check
    const [existing] = await useConnection.query(
      `SELECT id FROM stock_ledger 
       WHERE reference_doc_id = ? 
       AND grn_item_id = ? 
       AND transaction_type = 'GRN_IN'`,
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

    // Use addStockLedgerEntry for consistency and to ensure qty_in/qty_out are set
    await addStockLedgerEntry(
      itemCode,
      'GRN_IN',
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
        warehouse: 'RM-HOLD' // Default warehouse for GRN Receipt as per warehouseAllocationService
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
      params.push(materialType);
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
        materialType || null
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
  const group = (itemGroup || '').toUpperCase();
  
  if (group === 'FINISHED GOODS' || group === 'FG') {
    prefix = 'FG';
  } else if (group === 'RAW MATERIAL' || group === 'RM') {
    prefix = 'RM';
  } else if (group === 'SEMI FINISHED GOODS' || group === 'SFG') {
    prefix = 'SFG';
  } else if (group === 'SUB ASSEMBLY' || group === 'SA') {
    prefix = 'SA';
  } else if (group === 'ASSEMBLY' || group === 'ASSY') {
    prefix = 'ASSY';
  } else if (group) {
    prefix = group.substring(0, 3).toUpperCase();
  }

  // Clean item name for inclusion in code (alphanumeric only, max 10 chars)
  const cleanName = itemName ? itemName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase() : 'ITEM';
  const baseCode = `${prefix}-${cleanName}`;

  // Find the highest sequence number for this base code
  const [result] = await pool.query(
    'SELECT item_code FROM stock_balance WHERE item_code LIKE ? ORDER BY item_code DESC LIMIT 1',
    [`${baseCode}-%`]
  );
  
  let nextNumber = 1;
  if (result.length > 0) {
    const lastCode = result[0].item_code;
    const parts = lastCode.split('-');
    const lastNumStr = parts[parts.length - 1];
    const lastNumber = parseInt(lastNumStr);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

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

    await connection.execute(`
      INSERT INTO stock_balance (
        item_code, material_name, material_type, unit, 
        valuation_rate, selling_rate, no_of_cavity, 
        weight_per_unit, weight_uom, drawing_no, 
        revision, material_grade
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      itemCode,
      itemData.itemName,
      itemData.itemGroup,
      itemData.defaultUom || 'Nos',
      itemData.valuationRate || 0,
      itemData.sellingRate || 0,
      itemData.noOfCavity || 1,
      itemData.weightPerUnit || 0,
      itemData.weightUom || null,
      itemData.drawingNo || null,
      itemData.revision || null,
      itemData.materialGrade || null
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

    await connection.execute(`
      UPDATE stock_balance SET
        item_code = ?, material_name = ?, material_type = ?, unit = ?, 
        valuation_rate = ?, selling_rate = ?, no_of_cavity = ?, 
        weight_per_unit = ?, weight_uom = ?, drawing_no = ?, 
        revision = ?, material_grade = ?, last_updated = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      itemData.itemCode,
      itemData.itemName,
      itemData.itemGroup,
      itemData.defaultUom || 'Nos',
      itemData.valuationRate || 0,
      itemData.sellingRate || 0,
      itemData.noOfCavity || 1,
      itemData.weightPerUnit || 0,
      itemData.weightUom || null,
      itemData.drawingNo || null,
      itemData.revision || null,
      itemData.materialGrade || null,
      id
    ]);

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
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
  generateItemCode
};
