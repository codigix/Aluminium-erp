const pool = require('../config/db');

const calculateBalanceDetailsFromLedger = async (itemCode, connection = null) => {
  const executor = connection || pool;
  const [ledgerData] = await executor.query(`
    SELECT 
      SUM(CASE WHEN transaction_type = 'GRN_IN' THEN quantity ELSE 0 END) as accepted_qty,
      SUM(CASE WHEN transaction_type = 'OUT' THEN quantity ELSE 0 END) as issued_qty,
      SUM(CASE WHEN transaction_type IN ('GRN_IN', 'ADJUSTMENT', 'RETURN', 'IN') THEN quantity 
               WHEN transaction_type = 'OUT' THEN -quantity ELSE 0 END) as current_balance
    FROM stock_ledger 
    WHERE item_code = ?
  `, [itemCode]);

  const ledger = ledgerData[0] || {};
  return {
    received_qty: parseFloat(ledger.accepted_qty) || 0,
    accepted_qty: parseFloat(ledger.accepted_qty) || 0,
    issued_qty: parseFloat(ledger.issued_qty) || 0,
    current_balance: parseFloat(ledger.current_balance) || 0
  };
};

const deleteStockLedgerEntry = async (id) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [entries] = await connection.query('SELECT item_code FROM stock_ledger WHERE id = ?', [id]);
    if (entries.length === 0) {
      const error = new Error('Ledger entry not found');
      error.statusCode = 404;
      throw error;
    }

    const { item_code } = entries[0];

    await connection.execute('DELETE FROM stock_ledger WHERE id = ?', [id]);

    const details = await calculateBalanceDetailsFromLedger(item_code, connection);

    await connection.execute(`
      UPDATE stock_balance 
      SET current_balance = ?, last_updated = CURRENT_TIMESTAMP
      WHERE item_code = ?
    `, [details.current_balance, item_code]);

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
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
      id,
      item_code,
      item_description,
      material_name,
      material_type,
      unit,
      valuation_rate,
      selling_rate,
      no_of_cavity,
      weight_per_unit,
      weight_uom,
      drawing_no,
      drawing_id,
      revision,
      material_grade,
      last_updated
    FROM stock_balance
  `;

  const params = [];
  if (drawingNo) {
    query += ` WHERE drawing_no = ? `;
    params.push(drawingNo);
  }

  query += ` ORDER BY id DESC `;

  const [balances] = await pool.query(query, params);

  const result = [];
  for (const balance of balances) {
    const details = await calculateBalanceDetailsFromLedger(balance.item_code);
    
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

const addStockLedgerEntry = async (itemCode, transactionType, quantity, refDocType = null, refDocId = null, refDocNumber = null, remarks = null, userId = null) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let existingBalance = await getStockBalanceByItem(itemCode);

    let newBalance = 0;
    const matName = existingBalance?.material_name || null;
    const matType = existingBalance?.material_type || null;

    if (existingBalance) {
      const currentBalance = parseFloat(existingBalance.current_balance) || 0;
      const qty = parseFloat(quantity) || 0;

      if (transactionType === 'IN') {
        newBalance = currentBalance + qty;
      } else if (transactionType === 'OUT') {
        newBalance = Math.max(0, currentBalance - qty);
      } else if (transactionType === 'ADJUSTMENT' || transactionType === 'RETURN') {
        newBalance = currentBalance + qty;
      }

      await connection.execute(`
        INSERT INTO stock_ledger 
        (item_code, material_name, material_type, transaction_type, quantity, reference_doc_type, reference_doc_id, reference_doc_number, balance_after, remarks, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [itemCode, matName, matType, transactionType, quantity, refDocType, refDocId, refDocNumber, newBalance, remarks, userId]);

      await connection.execute(`
        UPDATE stock_balance 
        SET current_balance = ?, last_updated = CURRENT_TIMESTAMP
        WHERE item_code = ?
      `, [newBalance, itemCode]);
    } else {
      let newBalance = 0;
      if (transactionType === 'IN') {
        newBalance = parseFloat(quantity) || 0;
      }

      await connection.execute(`
        INSERT INTO stock_ledger 
        (item_code, material_name, material_type, transaction_type, quantity, reference_doc_type, reference_doc_id, reference_doc_number, balance_after, remarks, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [itemCode, matName, matType, transactionType, quantity, refDocType, refDocId, refDocNumber, newBalance, remarks, userId]);

      await connection.execute(`
        INSERT INTO stock_balance 
        (item_code, current_balance, material_name, material_type)
        VALUES (?, ?, ?, ?)
      `, [itemCode, newBalance, matName, matType]);
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

const createQCStockLedgerEntry = async (qcId, grnId, grnItemId, itemCode, passQty, connection = null) => {
  const useConnection = connection || (await pool.getConnection());
  
  try {
    if (!connection) {
      await useConnection.beginTransaction();
    }

    console.log(`[Stock] Creating entry for QC:${qcId}, GRN:${grnId}, Item:${itemCode}, Qty:${passQty}`);

    const [poItemRows] = await useConnection.query(
      `SELECT material_name, material_type, drawing_no, drawing_id FROM purchase_order_items poi
       JOIN grn_items gi ON poi.id = gi.po_item_id
       WHERE gi.id = ?`,
      [grnItemId]
    );
    const material_name = poItemRows[0]?.material_name || null;
    const material_type = poItemRows[0]?.material_type || null;
    const drawing_no = poItemRows[0]?.drawing_no || null;
    const drawing_id = poItemRows[0]?.drawing_id || null;

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

    const [currentBalanceRow] = await useConnection.query(
      `SELECT current_balance FROM stock_balance WHERE item_code = ? FOR UPDATE`,
      [itemCode]
    );

    let newBalance = 0;

    if (currentBalanceRow.length > 0) {
      newBalance = parseFloat(currentBalanceRow[0].current_balance) || 0;
      newBalance += parseFloat(passQty) || 0;
      console.log(`[Stock] Existing balance: ${currentBalanceRow[0].current_balance}, new: ${newBalance}`);

      await useConnection.execute(
        `INSERT INTO stock_ledger 
        (item_code, material_name, material_type, drawing_no, drawing_id, transaction_type, quantity, reference_doc_type, reference_doc_id, reference_doc_number, qc_id, grn_item_id, balance_after, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemCode, material_name, material_type, drawing_no, drawing_id, 'GRN_IN', passQty, 'GRN', grnId, `GRN-${String(grnId).padStart(4, '0')}`, qcId, grnItemId, newBalance, 'Auto-created from QC Pass']
      );

      await useConnection.execute(
        `UPDATE stock_balance SET current_balance = ?, material_name = ?, material_type = ?, drawing_no = ?, drawing_id = ?, last_updated = CURRENT_TIMESTAMP WHERE item_code = ?`,
        [newBalance, material_name, material_type, drawing_no, drawing_id, itemCode]
      );
      console.log(`[Stock] Created ledger entry and updated balance`);
    } else {
      newBalance = parseFloat(passQty) || 0;
      console.log(`[Stock] New item - balance: ${newBalance}`);

      await useConnection.execute(
        `INSERT INTO stock_ledger 
        (item_code, material_name, material_type, drawing_no, drawing_id, transaction_type, quantity, reference_doc_type, reference_doc_id, reference_doc_number, qc_id, grn_item_id, balance_after, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemCode, material_name, material_type, drawing_no, drawing_id, 'GRN_IN', passQty, 'GRN', grnId, `GRN-${String(grnId).padStart(4, '0')}`, qcId, grnItemId, newBalance, 'Auto-created from QC Pass']
      );

      await useConnection.execute(
        `INSERT INTO stock_balance (item_code, material_name, material_type, drawing_no, drawing_id, current_balance) VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE current_balance = VALUES(current_balance), material_name = VALUES(material_name), material_type = VALUES(material_type), drawing_no = VALUES(drawing_no), drawing_id = VALUES(drawing_id), last_updated = CURRENT_TIMESTAMP`,
        [itemCode, material_name, material_type, drawing_no, drawing_id, newBalance]
      );
      console.log(`[Stock] Created new balance and ledger entry`);
    }

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
