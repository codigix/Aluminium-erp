const pool = require('../config/db');

const getItemMaterials = async (itemId, itemCode = null, drawingNo = null) => {
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  let rows = [];
  
  let isHistorical = false;
  if (parsedItemId) {
    const [itemCheck] = await pool.query('SELECT status, bom_cost FROM sales_order_items WHERE id = ?', [parsedItemId]);
    if (itemCheck.length > 0) {
      isHistorical = ['APPROVED', 'RELEASED', 'COMPLETED'].includes(String(itemCheck[0].status).toUpperCase());
    }

    [rows] = await pool.query(
      `SELECT m.*, i.item_code as actual_item_code, i.material_name as actual_item_name,
              i.selling_rate as latest_selling_rate, i.valuation_rate as latest_valuation_rate, i.material_type as latest_material_type,
              i.length as latest_length, i.width as latest_width, i.thickness as latest_thickness,
              i.weight_per_unit as latest_weight_per_unit
       FROM sales_order_item_materials m
       LEFT JOIN (
         SELECT material_name, MIN(item_code) as item_code,
                MAX(selling_rate) as selling_rate, MAX(valuation_rate) as valuation_rate,
                MAX(material_type) as material_type,
                MAX(length) as length, MAX(width) as width, MAX(thickness) as thickness,
                MAX(weight_per_unit) as weight_per_unit
         FROM stock_balance 
         GROUP BY material_name
       ) i ON m.material_name = i.material_name
       WHERE m.sales_order_item_id = ? 
       ORDER BY m.created_at ASC`,
      [parsedItemId]
    );
  }
  
  // Fallback to Master/Template if no specific ID data found or NO ID provided
  if (rows.length === 0 && (itemCode || drawingNo)) {
    // If we have an ID but it's a specific revision, we should NOT fallback to master 
    // because revisions are meant to be historical snapshots. 
    if (parsedItemId) {
      const [itemRow] = await pool.query('SELECT sales_order_id, bom_cost FROM sales_order_items WHERE id = ?', [parsedItemId]);
      if (itemRow.length > 0) {
        if (itemRow[0].sales_order_id === null || parseFloat(itemRow[0].bom_cost) > 0) {
          console.log(`[getItemMaterials] Skipping fallback for specific revision ID ${parsedItemId}`);
          return [];
        }
      }
    }

    let query = `SELECT m.*, i.item_code as actual_item_code, i.material_name as actual_item_name,
                        i.selling_rate as latest_selling_rate, i.valuation_rate as latest_valuation_rate, i.material_type as latest_material_type,
                        i.length as latest_length, i.width as latest_width, i.thickness as latest_thickness,
                        i.weight_per_unit as latest_weight_per_unit
                 FROM sales_order_item_materials m 
                 LEFT JOIN (
                   SELECT material_name, MIN(item_code) as item_code,
                          MAX(selling_rate) as selling_rate, MAX(valuation_rate) as valuation_rate,
                          MAX(material_type) as material_type,
                          MAX(length) as length, MAX(width) as width, MAX(thickness) as thickness,
                          MAX(weight_per_unit) as weight_per_unit
                   FROM stock_balance 
                   GROUP BY material_name
                 ) i ON m.material_name = i.material_name 
                 WHERE m.sales_order_item_id IN (
                    SELECT id FROM (
                       SELECT id FROM sales_order_items 
                       WHERE (item_code = ? OR drawing_no = ?) 
                       AND sales_order_id IS NULL 
                       ORDER BY id DESC LIMIT 1
                    ) as t
                 )`;
    let params = [itemCode, drawingNo];

    [rows] = await pool.query(query + ' ORDER BY m.created_at ASC', params);
  }

  return rows.map(row => ({
    ...row,
    item_code: row.actual_item_code || row.item_code,
    material_name: row.actual_item_name || row.material_name,
    qty: row.qty_per_pc || row.qty,
    weightPerUnit: (isHistorical && parseFloat(row.weight_per_unit) > 0) ? row.weight_per_unit : (row.weight_per_unit || row.latest_weight_per_unit),
    scrapPercent: row.scrap_percent,
    // Add snake_case aliases
    weight_per_unit: (isHistorical && parseFloat(row.weight_per_unit) > 0) ? row.weight_per_unit : (row.weight_per_unit || row.latest_weight_per_unit),
    scrap_percent: row.scrap_percent,
    length: (isHistorical && parseFloat(row.length) > 0) ? row.length : (row.length || row.latest_length),
    width: (isHistorical && parseFloat(row.width) > 0) ? row.width : (row.width || row.latest_width),
    thickness: (isHistorical && parseFloat(row.thickness) > 0) ? row.thickness : (row.thickness || row.latest_thickness),
    diameter: (isHistorical && parseFloat(row.diameter) > 0) ? row.diameter : (row.diameter || row.latest_diameter),
    outer_diameter: (isHistorical && parseFloat(row.outer_diameter) > 0) ? row.outer_diameter : (row.outer_diameter || row.latest_outer_diameter),
    selling_rate: isHistorical ? (row.rate || row.latest_selling_rate) : row.latest_selling_rate,
    valuation_rate: isHistorical ? (row.rate || row.latest_valuation_rate) : row.latest_valuation_rate,
    material_type: row.latest_material_type
  }));
};

const getItemComponents = async (itemId, itemCode = null, drawingNo = null) => {
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  let rows = [];
  
  let isHistorical = false;
  if (parsedItemId) {
    const [itemCheck] = await pool.query('SELECT status, bom_cost FROM sales_order_items WHERE id = ?', [parsedItemId]);
    if (itemCheck.length > 0) {
      isHistorical = ['APPROVED', 'RELEASED', 'COMPLETED'].includes(String(itemCheck[0].status).toUpperCase());
    }

    [rows] = await pool.query(
      `SELECT c.*, i.selling_rate as latest_selling_rate, i.valuation_rate as latest_valuation_rate, i.weight_per_unit as latest_weight_per_unit
       FROM sales_order_item_components c
       LEFT JOIN (
         SELECT item_code, MAX(selling_rate) as selling_rate, MAX(valuation_rate) as valuation_rate, MAX(weight_per_unit) as weight_per_unit
         FROM stock_balance 
         GROUP BY item_code
       ) i ON c.component_code = i.item_code
       WHERE c.sales_order_item_id = ? 
       ORDER BY c.created_at ASC`,
      [parsedItemId]
    );
  }
  
  // Fallback to Master/Template if no specific ID data found or NO ID provided
  if (rows.length === 0 && (itemCode || drawingNo)) {
    if (parsedItemId) {
      const [itemRow] = await pool.query('SELECT sales_order_id, bom_cost FROM sales_order_items WHERE id = ?', [parsedItemId]);
      if (itemRow.length > 0) {
        if (itemRow[0].sales_order_id === null || parseFloat(itemRow[0].bom_cost) > 0) {
          console.log(`[getItemComponents] Skipping fallback for specific revision ID ${parsedItemId}`);
          return [];
        }
      }
    }
    let query = `SELECT c.*, i.selling_rate as latest_selling_rate, i.valuation_rate as latest_valuation_rate, i.weight_per_unit as latest_weight_per_unit
                 FROM sales_order_item_components c
                 LEFT JOIN (
                   SELECT item_code, MAX(selling_rate) as selling_rate, MAX(valuation_rate) as valuation_rate, MAX(weight_per_unit) as weight_per_unit
                   FROM stock_balance 
                   GROUP BY item_code
                 ) i ON c.component_code = i.item_code
                 WHERE c.sales_order_item_id IN (
                    SELECT id FROM (
                       SELECT id FROM sales_order_items 
                       WHERE (item_code = ? OR drawing_no = ?) 
                       AND sales_order_id IS NULL 
                       ORDER BY id DESC LIMIT 1
                    ) as t
                 )`;
    let params = [itemCode, drawingNo];

    if (latestIdRow.length > 0) {
      let query = `SELECT c.*, i.selling_rate as latest_selling_rate, i.valuation_rate as latest_valuation_rate, i.weight_per_unit as latest_weight_per_unit
                   FROM sales_order_item_components c
                   LEFT JOIN (
                     SELECT item_code, MAX(selling_rate) as selling_rate, MAX(valuation_rate) as valuation_rate, MAX(weight_per_unit) as weight_per_unit
                     FROM stock_balance 
                     GROUP BY item_code
                   ) i ON c.component_code = i.item_code
                   WHERE c.sales_order_item_id = ?`;
      
      [rows] = await pool.query(query + ' ORDER BY c.created_at ASC', [latestIdRow[0].id]);
    }

    // If still no rows, try latest from ANY sales order (not just master)
    if (rows.length === 0) {
      let fallbackQuery = `SELECT c.*, i.selling_rate as latest_selling_rate, i.valuation_rate as latest_valuation_rate, i.weight_per_unit as latest_weight_per_unit
                 FROM sales_order_item_components c
                 LEFT JOIN (
                   SELECT item_code, MAX(selling_rate) as selling_rate, MAX(valuation_rate) as valuation_rate, MAX(weight_per_unit) as weight_per_unit
                   FROM stock_balance 
                   GROUP BY item_code
                 ) i ON c.component_code = i.item_code
                 WHERE c.sales_order_item_id IN (
                    SELECT id FROM (
                       SELECT id FROM sales_order_items 
                       WHERE (item_code = ? OR drawing_no = ?) 
                       AND bom_cost > 0
                       ORDER BY id DESC LIMIT 1
                    ) as t
                 )`;
      [rows] = await pool.query(fallbackQuery + ' ORDER BY c.created_at ASC', params);
    }
  }

  // Dynamically fetch latest BOM cost for Sub-Assemblies in BULK to avoid N+1 problem
  const saComponents = rows.filter(row => {
    const compCode = row.component_code || row.componentCode;
    const group = (row.item_group || '').toLowerCase();
    return (compCode && (compCode.startsWith('SA-') || compCode.startsWith('SFG-'))) || 
           group.includes('assembly') || group.includes('sfg') || group.includes('semi');
  });

  if (saComponents.length > 0) {
    // Determine if we should even override the rates.
    // RULE: For specific historical revisions of Sales Order items (parsedItemId exists AND has a status like 'APPROVED'),
    // we should TRUST the stored rates in the components table as a snapshot.
    // For "Master" templates (no sales_order_id) or "New/Draft" items, we should use LATEST rates.
    let shouldOverride = !isHistorical;

    if (shouldOverride) {
      const codes = [...new Set(saComponents.map(c => c.component_code || c.componentCode))];
      try {
        // Fetch latest costs for all these components in one query
        const [latestCosts] = await pool.query(`
          SELECT item_code, drawing_no, bom_cost
          FROM sales_order_items
          WHERE item_code IN (?)
          AND bom_cost > 0
          AND id IN (
            SELECT max_id FROM (
                SELECT MAX(id) as max_id
                FROM sales_order_items
                WHERE item_code IN (?)
                AND bom_cost > 0
                GROUP BY item_code, IFNULL(drawing_no, '')
            ) as t
          )
        `, [codes, codes]);

        const costMap = new Map();
        latestCosts.forEach(c => {
          const key = `${c.item_code}|${c.drawing_no || ''}`;
          costMap.set(key, parseFloat(c.bom_cost));
          // Also keep a general fallback for the item code
          if (!costMap.has(c.item_code)) {
            costMap.set(c.item_code, parseFloat(c.bom_cost));
          }
        });

        // Update rates in rows using the cost map
        rows.forEach(row => {
          const compCode = row.component_code || row.componentCode;
          const group = (row.item_group || '').toLowerCase();
          const isSubAssy = (compCode && (compCode.startsWith('SA-') || compCode.startsWith('SFG-'))) || 
                             group.includes('assembly') || group.includes('sfg') || group.includes('semi');
          
          if (isSubAssy && compCode) {
            const key = `${compCode}|${row.drawing_no || ''}`;
            const latestRate = costMap.get(key) || costMap.get(compCode);
            if (latestRate !== undefined) {
              row.rate = latestRate;
            }
          }
        });
      } catch (err) {
        console.error('[getItemComponents] Bulk cost fetch error:', err.message);
      }
    }
  }

  return rows.map(row => ({
    ...row,
    qty: row.quantity || row.qty,
    quantity: row.quantity || row.qty,
    weight_per_unit: (isHistorical && parseFloat(row.weight_per_unit) > 0) ? row.weight_per_unit : (row.weight_per_unit || row.latest_weight_per_unit),
    length: (isHistorical && parseFloat(row.length) > 0) ? row.length : (row.length || row.latest_length || 0),
    width: (isHistorical && parseFloat(row.width) > 0) ? row.width : (row.width || row.latest_width || 0),
    thickness: (isHistorical && parseFloat(row.thickness) > 0) ? row.thickness : (row.thickness || row.latest_thickness || 0),
    diameter: (isHistorical && parseFloat(row.diameter) > 0) ? row.diameter : (row.diameter || row.latest_diameter || 0),
    outer_diameter: (isHistorical && parseFloat(row.outer_diameter) > 0) ? row.outer_diameter : (row.outer_diameter || row.latest_outer_diameter || 0),
    selling_rate: isHistorical ? (row.rate || row.latest_selling_rate) : row.latest_selling_rate,
    valuation_rate: isHistorical ? (row.rate || row.latest_valuation_rate) : row.latest_valuation_rate,
    bom_cost: (() => {
      const compCode = (row.component_code || row.componentCode || '').toUpperCase();
      const g = (row.item_group || '').toUpperCase();
      const isSA = (compCode.startsWith('SA-') || compCode.startsWith('SFG-') || g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY')) && !g.includes('FG');
      if (isSA) return parseFloat(row.rate || 0);
      // For materials: weight * valuation_rate
      return (parseFloat(row.weight_per_pc || row.weight_per_unit || 0) * parseFloat(isHistorical ? (row.rate || row.latest_valuation_rate || 0) : (row.latest_valuation_rate || 0)));
    })()
  }));
};

const getItemOperations = async (itemId, itemCode = null, drawingNo = null) => {
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  let rows = [];
  
  if (parsedItemId) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_operations WHERE sales_order_item_id = ? ORDER BY created_at ASC',
      [parsedItemId]
    );
  }
  
  // Fallback to Master/Template if no specific ID data found or NO ID provided
  if (rows.length === 0 && (itemCode || drawingNo)) {
    if (parsedItemId) {
      const [itemRow] = await pool.query('SELECT sales_order_id, bom_cost FROM sales_order_items WHERE id = ?', [parsedItemId]);
      if (itemRow.length > 0) {
        if (itemRow[0].sales_order_id === null || parseFloat(itemRow[0].bom_cost) > 0) {
          console.log(`[getItemOperations] Skipping fallback for specific revision ID ${parsedItemId}`);
          return [];
        }
      }
    }
    let query = `SELECT * FROM sales_order_item_operations 
                 WHERE sales_order_item_id IN (
                    SELECT id FROM (
                       SELECT id FROM sales_order_items 
                       WHERE (item_code = ? OR drawing_no = ?) 
                       AND sales_order_id IS NULL 
                       ORDER BY id DESC LIMIT 1
                    ) as t
                 )`;
    let params = [itemCode, drawingNo];

    [rows] = await pool.query(query + ' ORDER BY created_at ASC', params);
  }
  return rows.map(row => ({
    ...row,
    operationName: row.operation_name,
    cycleTimeMin: row.cycle_time_min,
    setupTimeMin: row.setup_time_min,
    hourlyRate: row.hourly_rate,
    operationType: row.operation_type,
    targetWarehouse: row.target_warehouse,
    // Add snake_case aliases for frontend calculation logic consistency
    operation_name: row.operation_name,
    cycle_time_min: row.cycle_time_min,
    setup_time_min: row.setup_time_min,
    hourly_rate: row.hourly_rate,
    operation_type: row.operation_type,
    target_warehouse: row.target_warehouse
  }));
};

const getItemScrap = async (itemId, itemCode = null, drawingNo = null) => {
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  let rows = [];
  
  if (parsedItemId) {
    [rows] = await pool.query(
      'SELECT * FROM sales_order_item_scrap WHERE sales_order_item_id = ? ORDER BY created_at ASC',
      [parsedItemId]
    );
  }
  
  // Fallback to Master/Template if no specific ID data found or NO ID provided
  if (rows.length === 0 && (itemCode || drawingNo)) {
    if (parsedItemId) {
      const [itemRow] = await pool.query('SELECT sales_order_id, bom_cost FROM sales_order_items WHERE id = ?', [parsedItemId]);
      if (itemRow.length > 0) {
        if (itemRow[0].sales_order_id === null || parseFloat(itemRow[0].bom_cost) > 0) {
          console.log(`[getItemScrap] Skipping fallback for specific revision ID ${parsedItemId}`);
          return [];
        }
      }
    }
    let query = `SELECT * FROM sales_order_item_scrap 
                 WHERE sales_order_item_id IN (
                    SELECT id FROM (
                       SELECT id FROM sales_order_items 
                       WHERE (item_code = ? OR drawing_no = ?) 
                       AND sales_order_id IS NULL 
                       ORDER BY id DESC LIMIT 1
                    ) as t
                 )`;
    let params = [itemCode, drawingNo];

    if (latestIdRow.length > 0) {
      [rows] = await pool.query(
        'SELECT * FROM sales_order_item_scrap WHERE sales_order_item_id = ? ORDER BY created_at ASC',
        [latestIdRow[0].id]
      );
    }
  }
  return rows.map(row => ({
    ...row,
    inputQty: row.input_qty,
    lossPercent: row.loss_percent,
    // Add snake_case aliases
    input_qty: row.input_qty,
    loss_percent: row.loss_percent
  }));
};

const addItemMaterial = async (itemId, materialData) => {
  const { 
    itemCode, drawingNo, materialName, materialType, 
    itemGroup, qtyPerPc, uom, rate, warehouse, 
    operation, parentId, description,
    weight_per_unit, scrap_percent,
    length, width, thickness, diameter, outer_diameter
  } = materialData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  
  // Raw materials are GLOBAL - they should not be linked to any specific drawing
  const effectiveDrawingNo = itemGroup === 'Raw Material' ? null : (drawingNo || null);

  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_materials (sales_order_item_id, item_code, drawing_no, parent_id, material_name, material_type, item_group, qty_per_pc, uom, rate, warehouse, operation, description, weight_per_unit, scrap_percent, length, width, thickness, diameter, outer_diameter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      parsedItemId, 
      itemCode || null, 
      effectiveDrawingNo, 
      parentId || null, 
      materialName || null, 
      materialType || null, 
      itemGroup || null, 
      qtyPerPc || null, 
      uom || null, 
      rate || 0, 
      warehouse || null, 
      operation || null, 
      description || null, 
      weight_per_unit || 0, 
      scrap_percent || 0,
      length || 0,
      width || 0,
      thickness || 0,
      diameter || 0,
      outer_diameter || 0
    ]
  );
  return result.insertId;
};

const addComponent = async (itemId, componentData) => {
  const { 
    itemCode, drawingNo, componentCode, description, quantity, uom, rate, lossPercent, notes, parentId,
    itemGroup, weight_per_unit, scrap_percent, length, width, thickness, diameter, outer_diameter 
  } = componentData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_components (sales_order_item_id, item_code, drawing_no, parent_id, component_code, description, quantity, uom, rate, loss_percent, notes, item_group, weight_per_unit, scrap_percent, length, width, thickness, diameter, outer_diameter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      parsedItemId, 
      itemCode || null, 
      drawingNo || null, 
      parentId || null, 
      componentCode || null, 
      description || null, 
      quantity || null, 
      uom || null, 
      rate || null, 
      lossPercent || null, 
      notes || null,
      itemGroup || null,
      weight_per_unit || 0,
      scrap_percent || 0,
      length || 0,
      width || 0,
      thickness || 0,
      diameter || 0,
      outer_diameter || 0
    ]
  );
  return result.insertId;
};

const addOperation = async (itemId, operationData) => {
  const { 
    itemCode, 
    drawingNo, 
    operationName, 
    workstation, 
    cycleTimeMin, 
    setupTimeMin, 
    hourlyRate, 
    operationType,
    operation_type, 
    targetWarehouse 
  } = operationData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_operations (sales_order_item_id, item_code, drawing_no, operation_name, workstation, cycle_time_min, setup_time_min, hourly_rate, operation_type, target_warehouse) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      parsedItemId, 
      itemCode || null, 
      drawingNo || null, 
      operationName || null, 
      workstation || null, 
      cycleTimeMin || 0, 
      setupTimeMin || 0, 
      hourlyRate || 0, 
      operationType || operation_type || 'In-House', 
      targetWarehouse || null
    ]
  );
  return result.insertId;
};

const addScrap = async (itemId, scrapData) => {
  const { parentItemCode, drawingNo, scrapItemCode, itemCode, itemName, inputQty, lossPercent, rate, parentId } = scrapData;
  const parsedItemId = (itemId === 'null' || itemId === 'undefined' || !itemId) ? null : itemId;
  const [result] = await pool.execute(
    'INSERT INTO sales_order_item_scrap (sales_order_item_id, item_code, drawing_no, parent_id, scrap_item_code, item_name, input_qty, loss_percent, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      parsedItemId, 
      parentItemCode || null, 
      drawingNo || null,
      parentId || null,
      scrapItemCode || itemCode || null, 
      itemName || null, 
      inputQty || 0, 
      lossPercent || 0, 
      rate || 0
    ]
  );
  return result.insertId;
};

const updateItemMaterial = async (materialId, materialData) => {
  const { 
    materialName, material_name, 
    materialType, material_type, 
    itemGroup, item_group, 
    qtyPerPc, qty_per_pc, 
    uom, rate, warehouse, operation, description, 
    weight_per_unit, weightPerUnit, 
    scrap_percent, scrapPercent 
  } = materialData;

  await pool.execute(
    'UPDATE sales_order_item_materials SET material_name = ?, material_type = ?, item_group = ?, qty_per_pc = ?, uom = ?, rate = ?, warehouse = ?, operation = ?, description = ?, weight_per_unit = ?, scrap_percent = ? WHERE id = ?',
    [
      material_name || materialName || null, 
      material_type || materialType || null, 
      item_group || itemGroup || null, 
      qty_per_pc || qtyPerPc || 0, 
      uom || null, 
      rate || 0, 
      warehouse || null, 
      operation || null, 
      description || null, 
      weight_per_unit || weightPerUnit || 0, 
      scrap_percent || scrapPercent || 0, 
      materialId
    ]
  );
};

const updateOperation = async (id, data) => {
  const { 
    operation_name, operationName, 
    workstation, 
    cycle_time_min, cycleTimeMin, 
    setup_time_min, setupTimeMin, 
    hourly_rate, hourlyRate, 
    operation_type, operationType, 
    target_warehouse, targetWarehouse 
  } = data;

  await pool.execute(
    `UPDATE sales_order_item_operations 
     SET operation_name = ?, workstation = ?, cycle_time_min = ?, setup_time_min = ?, hourly_rate = ?, operation_type = ?, target_warehouse = ? 
     WHERE id = ?`,
    [
      operation_name || operationName || null,
      workstation || null,
      cycle_time_min || cycleTimeMin || 0,
      setup_time_min || setupTimeMin || 0,
      hourly_rate || hourlyRate || 0,
      operation_type || operationType || 'In-House',
      target_warehouse || targetWarehouse || null,
      id
    ]
  );
};

const updateComponent = async (id, data) => {
  const { 
    component_code, componentCode, 
    description, quantity, uom, rate, 
    loss_percent, lossPercent, 
    notes, 
    item_group, itemGroup, 
    weight_per_unit, weightPerUnit, 
    scrap_percent, scrapPercent 
  } = data;

  await pool.execute(
    `UPDATE sales_order_item_components 
     SET component_code = ?, description = ?, quantity = ?, uom = ?, rate = ?, loss_percent = ?, notes = ?, item_group = ?, weight_per_unit = ?, scrap_percent = ? 
     WHERE id = ?`,
    [
      component_code || componentCode || null, 
      description || null, 
      quantity || 0, 
      uom || null, 
      rate || 0, 
      loss_percent || lossPercent || 0, 
      notes || null,
      item_group || itemGroup || null,
      weight_per_unit || weightPerUnit || 0,
      scrap_percent || scrapPercent || 0,
      id
    ]
  );
};

const updateScrap = async (id, data) => {
  const { 
    scrap_item_code, scrapItemCode, 
    item_code, itemCode, 
    item_name, itemName, 
    input_qty, inputQty, 
    loss_percent, lossPercent, 
    rate 
  } = data;

  await pool.execute(
    `UPDATE sales_order_item_scrap 
     SET scrap_item_code = ?, item_name = ?, input_qty = ?, loss_percent = ?, rate = ? 
     WHERE id = ?`,
    [
      scrap_item_code || scrapItemCode || item_code || itemCode || null, 
      item_name || itemName || null, 
      input_qty || inputQty || 0, 
      loss_percent || lossPercent || 0, 
      rate || 0, 
      id
    ]
  );
};

const deleteItemMaterial = async (materialId) => {
  await pool.execute('DELETE FROM sales_order_item_materials WHERE id = ?', [materialId]);
};

const deleteComponent = async (id) => {
  // Find child components recursively
  const [childComponents] = await pool.query('SELECT id FROM sales_order_item_components WHERE parent_id = ?', [id]);
  for (const child of childComponents) {
    await deleteComponent(child.id);
  }
  
  // Delete child materials
  await pool.execute('DELETE FROM sales_order_item_materials WHERE parent_id = ?', [id]);
  
  // Delete child scrap
  await pool.execute('DELETE FROM sales_order_item_scrap WHERE parent_id = ?', [id]);
  
  // Delete the component itself
  await pool.execute('DELETE FROM sales_order_item_components WHERE id = ?', [id]);
};

const deleteOperation = async (id) => {
  await pool.execute('DELETE FROM sales_order_item_operations WHERE id = ?', [id]);
};

const deleteScrap = async (id) => {
  await pool.execute('DELETE FROM sales_order_item_scrap WHERE id = ?', [id]);
};

const getBOMBySalesOrder = async (salesOrderId) => {
  const [items] = await pool.query(
    'SELECT id, item_code, drawing_no, description FROM sales_order_items WHERE sales_order_id = ?',
    [salesOrderId]
  );

  const fullBOM = [];

  for (const item of items) {
    const materials = await getItemMaterials(item.id, item.item_code, item.drawing_no);
    const components = await getItemComponents(item.id, item.item_code, item.drawing_no);
    const operations = await getItemOperations(item.id, item.item_code, item.drawing_no);
    const scrap = await getItemScrap(item.id, item.item_code, item.drawing_no);

    fullBOM.push({
      item_id: item.id,
      item_code: item.item_code,
      drawing_no: item.drawing_no,
      item_description: item.description,
      materials,
      components,
      operations,
      scrap
    });
  }

  return fullBOM;
};

const createBOMRequest = async (bomData) => {
  const { itemId, salesOrderId, status, productForm, materials, components, operations, scrap, source, costing, isNewVersion } = bomData;
  console.log(`[createBOMRequest] ItemID: ${itemId}, SOID: ${salesOrderId}, Status: ${status}, Source: ${source}, Drawing: ${productForm.drawingNo}, isNewVersion: ${isNewVersion}`);
  
  const { itemCode, itemGroup, uom, revision, description, notes, isActive, isDefault, quantity, drawingNo, drawing_id } = productForm;
  const bom_cost = costing?.costPerUnit || 0;
  const finalStatus = status || 'Active';
  
  const effectiveDescription = (notes && notes.trim()) ? notes : description;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const safeItemCode = itemCode || null;

    let itemType = 'FG';
    if (safeItemCode) {
      if (safeItemCode.startsWith('SA-')) itemType = 'SA';
      else if (safeItemCode.startsWith('SFG-')) itemType = 'SFG';
      else if (safeItemCode.startsWith('RM-')) itemType = 'RM';
    }

    let targetItemId = itemId;
    let effectiveBomId = null;

    if (itemId) {
      // Get existing bom_id
      const [existing] = await connection.query('SELECT bom_id FROM sales_order_items WHERE id = ?', [itemId]);
      if (existing.length > 0) {
        effectiveBomId = existing[0].bom_id;
        
        // If the original item doesn't have a bom_id yet, it becomes the root
        if (!effectiveBomId) {
          effectiveBomId = itemId;
          // Update the original item to point to itself as the root
          await connection.execute('UPDATE sales_order_items SET bom_id = ? WHERE id = ?', [itemId, itemId]);
        }
      }
    }

    if (itemId && !isNewVersion) {
      // 1. UPDATE Mode
      await connection.execute(
        `UPDATE sales_order_items 
         SET item_code = ?, item_type = ?, item_group = ?, unit = ?, revision_no = ?, description = ?, is_active = ?, is_default = ?, drawing_no = ?, drawing_id = ?, bom_cost = ?, 
             bom_id = IFNULL(bom_id, ?),
             status = CASE WHEN UPPER(TRIM(status)) = 'APPROVED' THEN status ELSE ? END
         WHERE id = ?`,
        [
          safeItemCode, 
          itemType,
          itemGroup || null, 
          uom || null, 
          revision || null, 
          effectiveDescription || null, 
          isActive ? 1 : 0, 
          isDefault ? 1 : 0, 
          drawingNo || null, 
          drawing_id || null, 
          bom_cost,
          effectiveBomId || itemId,
          finalStatus === 'Draft' ? 'DRAFT' : 'PENDING',
          itemId
        ]
      );

      // Clear existing BOM items
      await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
      await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [itemId]);
      await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    } else {
      // 2. CREATE or NEW VERSION Mode
      let initialStatus = finalStatus === 'Draft' ? 'DRAFT' : 'PENDING';
      if (salesOrderId && drawingNo) {
        const [approvalCheck] = await connection.query(
          "SELECT status FROM sales_order_items WHERE sales_order_id = ? AND drawing_no = ? AND UPPER(TRIM(status)) = 'APPROVED' LIMIT 1",
          [salesOrderId, drawingNo]
        );
        if (approvalCheck.length > 0) initialStatus = approvalCheck[0].status;
      }

      const [result] = await connection.execute(
        `INSERT INTO sales_order_items 
         (sales_order_id, bom_id, item_code, item_type, item_group, unit, revision_no, description, is_active, is_default, quantity, drawing_no, drawing_id, bom_cost, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          salesOrderId || null,
          effectiveBomId, // Will be NULL if completely new, or parent ID if new version
          safeItemCode,
          itemType,
          itemGroup || null,
          uom || null,
          revision || null,
          effectiveDescription || null,
          isActive ? 1 : 0,
          isDefault ? 1 : 0,
          quantity || 0,
          drawingNo || null,
          drawing_id || null,
          bom_cost,
          initialStatus
        ]
      );
      targetItemId = result.insertId;

      // If this is the first version of a new BOM, update bom_id to point to itself
      if (!effectiveBomId) {
        await connection.execute('UPDATE sales_order_items SET bom_id = ? WHERE id = ?', [targetItemId, targetItemId]);
      }
    }

    // 3. Insert new BOM items
    let targetIds = [{ id: targetItemId }];
    
    for (const target of targetIds) {
      const linkId = target.id;
      const idMap = {}; 
      const componentUpdateList = []; 

      if (components && components.length > 0) {
        for (const c of components) {
          const compCode = c.component_code || c.componentCode || null;
          const isSA = compCode && (compCode.startsWith('SA-') || compCode.startsWith('SFG-'));
          const sourceFg = c.sourceFg || c.source_fg || (isSA ? (drawingNo || null) : null);

          const [result] = await connection.execute(
            'INSERT INTO sales_order_item_components (sales_order_item_id, item_code, drawing_no, source_fg, parent_id, component_code, description, quantity, uom, rate, loss_percent, notes, item_group, weight_per_unit, scrap_percent, length, width, thickness, diameter, outer_diameter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              linkId, 
              safeItemCode, 
              drawingNo || null,
              sourceFg,
              null, // Temporarily set parent_id to null
              compCode, 
              c.description || null, 
              c.quantity || c.qty || 0, 
              c.uom || null, 
              c.rate || 0, 
              c.loss_percent || c.lossPercent || 0, 
              c.notes || null,
              c.item_group || c.itemGroup || null,
              c.weight_per_unit || c.weightPerUnit || 0,
              c.scrap_percent || c.scrapPercent || 0,
              c.length || 0,
              c.width || 0,
              c.thickness || 0,
              c.diameter || 0,
              c.outer_diameter || 0
            ]
          );
          
          const newId = result.insertId;
          const oldId = c.id;
          idMap[oldId] = newId;
          
          const oldParentId = c.parent_id || c.parentId;
          if (oldParentId) {
            componentUpdateList.push({ id: newId, oldParentId });
          }
        }

        // Update parent_id for components
        for (const item of componentUpdateList) {
          const newParentId = idMap[item.oldParentId];
          if (newParentId) {
            await connection.execute(
              'UPDATE sales_order_item_components SET parent_id = ? WHERE id = ?',
              [newParentId, item.id]
            );
          }
        }
      }

      if (materials && materials.length > 0) {
        for (const m of materials) {
          const oldParentId = m.parent_id || m.parentId;
          const newParentId = oldParentId ? idMap[oldParentId] : null;

          await connection.execute(
            'INSERT INTO sales_order_item_materials (sales_order_item_id, item_code, drawing_no, parent_id, material_name, material_type, item_group, qty_per_pc, uom, rate, warehouse, operation, description, weight_per_unit, scrap_percent, length, width, thickness, diameter, outer_diameter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              linkId, 
              safeItemCode, 
              drawingNo || null,
              newParentId,
              m.material_name || m.materialName || null, 
              m.material_type || m.materialType || null, 
              m.item_group || m.itemGroup || null, 
              m.qty_per_pc || m.qtyPerPc || m.qty || 0, 
              m.uom || null, 
              m.rate || 0, 
              m.warehouse || null, 
              m.operation || null,
              m.description || null,
              m.weight_per_unit || m.weightPerUnit || 0,
              m.scrap_percent || m.scrapPercent || 0,
              m.length || m.length || 0,
              m.width || m.width || 0,
              m.thickness || m.thickness || 0,
              m.diameter || m.diameter || 0,
              m.outer_diameter || m.outer_diameter || 0
            ]
          );
        }
      }

      if (operations && operations.length > 0) {
        for (const o of operations) {
          await connection.execute(
            'INSERT INTO sales_order_item_operations (sales_order_item_id, item_code, drawing_no, operation_name, workstation, cycle_time_min, setup_time_min, hourly_rate, operation_type, target_warehouse) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              linkId, 
              safeItemCode, 
              drawingNo || null,
              o.operation_name || o.operationName || null, 
              o.workstation || null, 
              o.cycle_time_min || o.cycleTimeMin || 0, 
              o.setup_time_min || o.setupTimeMin || 0, 
              o.hourly_rate || o.hourlyRate || 0, 
              o.operation_type || o.operationType || 'In-House', 
              o.target_warehouse || o.targetWarehouse || null
            ]
          );
        }
      }

      if (scrap && scrap.length > 0) {
        for (const s of scrap) {
          const oldParentId = s.parent_id || s.parentId;
          const newParentId = oldParentId ? idMap[oldParentId] : null;

          await connection.execute(
            'INSERT INTO sales_order_item_scrap (sales_order_item_id, item_code, drawing_no, parent_id, scrap_item_code, item_name, input_qty, loss_percent, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              linkId, 
              safeItemCode, 
              drawingNo || null,
              newParentId,
              s.scrap_item_code || s.scrapItemCode || s.item_code || s.itemCode || null, 
              s.item_name || s.itemName || null, 
              s.input_qty || s.inputQty || 0, 
              s.loss_percent || s.lossPercent || 0, 
              s.rate || 0
            ]
          );
        }
      }
    }

    // 4. Update sales_order status (only if linked to sales order)
    // 4. Removed automatic update of sales_order status to BOM_SUBMITTED
    // This allows manual submission via "BOM Approval" button in frontend
    
    await connection.commit();

    // 5. Post-Commit: Propagate costs and sync latest versions
    try {
      if (finalStatus !== 'Draft') {
        setImmediate(async () => {
          try {
            // Update all matching LATEST versions across all sales orders to keep lists in sync
            if (safeItemCode) {
              await pool.execute(`
                UPDATE sales_order_items 
                SET bom_cost = ?, updated_at = NOW()
                WHERE item_code = ? 
                AND (drawing_no = ? OR (drawing_no IS NULL AND ? IS NULL))
                AND id IN (
                  SELECT max_id FROM (
                    SELECT MAX(id) as max_id 
                    FROM sales_order_items 
                    GROUP BY sales_order_id, IFNULL(bom_id, item_code)
                  ) as t
                )
              `, [bom_cost, safeItemCode, drawingNo, drawingNo]);
            }

            await propagateCostToParents(safeItemCode, drawingNo);
          } catch (propError) {
            console.error(`[Cost Propagation Error] Failed for ${safeItemCode}:`, propError.message);
          }
        });
      }
    } catch (bgError) {
      console.error('[Background Task Error]:', bgError.message);
    }

    return { success: true, id: targetItemId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getApprovedBOMs = async () => {
  const [rows] = await pool.query(`
    SELECT 
      soi.id,
      soi.bom_id,
      soi.item_code,
      soi.item_group,
      soi.drawing_no,
      soi.description,
      soi.unit,
      soi.quantity,
      soi.bom_cost,
      soi.revision_no as version,
      soi.status as item_status,
      c.company_name,
      so.project_name,
      so.id as sales_order_id,
      soi.created_at,
      (SELECT COUNT(*) FROM sales_order_items v WHERE v.bom_id = soi.bom_id OR (v.item_code = soi.item_code AND v.drawing_no = soi.drawing_no)) as version_count
    FROM sales_order_items soi
    LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
    LEFT JOIN companies c ON so.company_id = c.id
    INNER JOIN (
      SELECT 
        IFNULL(bom_id, id) as group_id,
        MAX(id) as latest_id
      FROM sales_order_items
      GROUP BY group_id
    ) latest ON (IFNULL(soi.bom_id, soi.id) = latest.group_id AND soi.id = latest.latest_id)
    WHERE (
      TRIM(IFNULL(so.status, '')) IN ('CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_Approved', 'BOM_SUBMITTED', 'BOM_Approved', 'PROCUREMENT_IN_PROGRESS', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'QUOTATION_SENT', 'QUOTATION_REJECTED', 'QUOTATION_ACCEPTED', 'APPROVED')
      OR soi.status IN ('DRAFT', 'PENDING', 'Approved')
      OR soi.sales_order_id IS NULL
    )
    AND (
      soi.bom_cost > 0
      OR EXISTS (SELECT 1 FROM sales_order_item_materials WHERE sales_order_item_id = soi.id)
      OR EXISTS (SELECT 1 FROM sales_order_item_components WHERE sales_order_item_id = soi.id)
      OR EXISTS (SELECT 1 FROM sales_order_item_operations WHERE sales_order_item_id = soi.id)
    )
    ORDER BY (CASE WHEN soi.bom_cost > 0 THEN 1 ELSE 2 END) ASC, soi.created_at DESC
  `);
  return rows;
};

const deleteBOM = async (itemId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Handle references in other tables - set to NULL so they don't break but aren't linked to a deleted BOM
    await connection.execute('UPDATE quotation_requests SET sales_order_item_id = NULL WHERE sales_order_item_id = ?', [itemId]);
    await connection.execute('UPDATE production_plan_items SET sales_order_item_id = NULL WHERE sales_order_item_id = ?', [itemId]);
    await connection.execute('UPDATE work_orders SET sales_order_item_id = NULL WHERE sales_order_item_id = ?', [itemId]);

    // 2. Delete item-specific BOM entries
    // For components, we might have a hierarchy. To avoid FK issues, we delete from leaf to root or disable checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    await connection.execute('DELETE FROM sales_order_item_materials WHERE sales_order_item_id = ?', [itemId]);
    await connection.execute('DELETE FROM sales_order_item_components WHERE sales_order_item_id = ?', [itemId]);
    await connection.execute('DELETE FROM sales_order_item_operations WHERE sales_order_item_id = ?', [itemId]);
    await connection.execute('DELETE FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [itemId]);

    // 3. Delete the version record itself from sales_order_items
    await connection.execute('DELETE FROM sales_order_items WHERE id = ?', [itemId]);

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    throw error;
  } finally {
    connection.release();
  }
};

const findAnyBOM = async (itemCode, drawingNo) => {
  // Find the most recently updated sales_order_item that has a BOM for this identity
  // Prioritize item_code match, then fallback to drawing_no
  let [rows] = await pool.query(`
    SELECT id FROM sales_order_items 
    WHERE (item_code = ? OR (drawing_no = ? AND drawing_no IS NOT NULL))
    AND (
      EXISTS (SELECT 1 FROM sales_order_item_materials WHERE sales_order_item_id = sales_order_items.id)
      OR EXISTS (SELECT 1 FROM sales_order_item_components WHERE sales_order_item_id = sales_order_items.id)
      OR EXISTS (SELECT 1 FROM sales_order_item_operations WHERE sales_order_item_id = sales_order_items.id)
    )
    ORDER BY (CASE WHEN item_code = ? THEN 1 ELSE 2 END) ASC, updated_at DESC LIMIT 1
  `, [itemCode, drawingNo, itemCode]);

  if (rows.length === 0) return null;
  
  const itemId = rows[0].id;
  const materials = await getItemMaterials(itemId);
  const components = await getItemComponents(itemId);
  const operations = await getItemOperations(itemId);
  
  return { materials, components, operations };
};

const getBOMHistory = async (itemCode, drawingNo, itemId = null) => {
  let effectiveItemCode = itemCode;
  let effectiveDrawingNo = drawingNo;
  let effectiveBomId = null;

  // If we have an itemId, fetch identity and bom_id
  if (itemId) {
    const [itemRows] = await pool.query(
      'SELECT item_code, drawing_no, bom_id FROM sales_order_items WHERE id = ?',
      [itemId]
    );
    if (itemRows.length > 0) {
      effectiveItemCode = effectiveItemCode || itemRows[0].item_code;
      effectiveDrawingNo = effectiveDrawingNo || itemRows[0].drawing_no;
      effectiveBomId = itemRows[0].bom_id;
    }
  }

  const queryParams = [];
  let whereClause = '';

  if (effectiveBomId) {
    whereClause = '(soi.bom_id = ? OR soi.id = ?)';
    queryParams.push(effectiveBomId, effectiveBomId);
  } else {
    const clauses = [];
    if (effectiveItemCode && effectiveItemCode.trim() !== '') {
      if (effectiveDrawingNo && effectiveDrawingNo.trim() !== '') {
        clauses.push('(LOWER(TRIM(soi.item_code)) = LOWER(TRIM(?)) AND LOWER(TRIM(soi.drawing_no)) = LOWER(TRIM(?)))');
        queryParams.push(effectiveItemCode, effectiveDrawingNo);
      } else {
        clauses.push('LOWER(TRIM(soi.item_code)) = LOWER(TRIM(?))');
        queryParams.push(effectiveItemCode);
      }
    } else if (effectiveDrawingNo && effectiveDrawingNo.trim() !== '') {
      clauses.push('LOWER(TRIM(soi.drawing_no)) = LOWER(TRIM(?))');
      queryParams.push(effectiveDrawingNo);
    }

    if (clauses.length === 0) {
      return [];
    }
    
    whereClause = `(${clauses.join(' OR ')})`;
  }

  const sql = `
    SELECT 
      soi.id,
      soi.revision_no as version,
      soi.status,
      soi.updated_at as revision_date,
      soi.bom_cost as total_cost,
      CONCAT(u.first_name, ' ', u.last_name) as changed_by
    FROM sales_order_items soi
    LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
    LEFT JOIN users u ON soi.created_by = u.id
    WHERE ${whereClause}
    ORDER BY CAST(soi.revision_no AS UNSIGNED) ASC, soi.id ASC
  `;
  
  const [rows] = await pool.query(sql, queryParams);
  return rows;
};

const getLatestBOMCost = async (itemCode, drawingNo, bomId) => {
  let whereClause = '1=1';
  let queryParams = [];

  if (bomId) {
    whereClause = 'soi.bom_id = ?';
    queryParams.push(bomId);
  } else if (itemCode && drawingNo) {
    whereClause = 'soi.item_code = ? AND soi.drawing_no = ?';
    queryParams.push(itemCode, drawingNo);
  } else {
    return { bom_cost: 0, revision_no: null };
  }

  const sql = `
    SELECT bom_cost, revision_no, id
    FROM sales_order_items soi
    WHERE ${whereClause}
    AND bom_cost > 0
    ORDER BY 
      CAST(REGEXP_REPLACE(IFNULL(revision_no, '0'), '[^0-9]', '') AS UNSIGNED) DESC, 
      id DESC
    LIMIT 1
  `;

  const [rows] = await pool.query(sql, queryParams);
  if (rows.length > 0) {
    return { 
      bom_cost: parseFloat(rows[0].bom_cost) || 0, 
      revision_no: rows[0].revision_no,
      id: rows[0].id
    };
  }
  return { bom_cost: 0, revision_no: null, id: null };
};

/**
 * Recalculates the cost of a BOM based on its latest finalized version components
 */
const recalculateBOMCost = async (itemId, forceUpdate = false) => {
  if (!itemId) return 0;

  // 1. Fetch item info and its components, materials, operations, and scrap
  const [itemRows] = await pool.query('SELECT item_code, drawing_no, quantity, status, bom_cost FROM sales_order_items WHERE id = ?', [itemId]);
  if (itemRows.length === 0) return 0;
  const parentItem = itemRows[0];

  const status = String(parentItem.status || '').toUpperCase();
  const isApproved = ['APPROVED', 'RELEASED', 'COMPLETED'].includes(status);
  
  // If it's an approved or finalized version, we usually skip unless forced
  if (isApproved && !forceUpdate) {
    console.log(`[recalculateBOMCost] Skipping update for APPROVED version ${itemId} (Force: ${forceUpdate})`);
    return parseFloat(parentItem.bom_cost) || 0;
  }

  const [materials] = await pool.query('SELECT * FROM sales_order_item_materials WHERE sales_order_item_id = ?', [itemId]);
  const [components] = await pool.query('SELECT * FROM sales_order_item_components WHERE sales_order_item_id = ?', [itemId]);
  const [operations] = await pool.query('SELECT * FROM sales_order_item_operations WHERE sales_order_item_id = ?', [itemId]);
  const [scrap] = await pool.query('SELECT * FROM sales_order_item_scrap WHERE sales_order_item_id = ?', [itemId]);

  // 2. Helper for recursive cost (mimicking frontend logic)
  const calculateItemCost = async (item, allItems) => {
    const isMaterial = !!(item.material_name);
    const itemGroup = (item.item_group || '').toLowerCase();
    const materialType = (item.material_type || '').toLowerCase();
    const materialName = (item.material_name || '').toLowerCase();
    
    const isConsumable = itemGroup.includes('consumable') || 
                         materialType.includes('consumable') || 
                         materialName.includes('consumable');

    const qty = parseFloat(isMaterial ? (item.qty_per_pc || 0) : (item.quantity || 0));
    let rate = parseFloat(item.rate || 0);

    // If it's a sub-assembly component, fetch its LATEST cost instead of using stored rate
    // We use latest cost if parent is NOT approved OR if we are forcing an update
    const isSA = item.component_code && (item.component_code.startsWith('SA-') || item.component_code.startsWith('SFG-'));
    
    if ((!isApproved || forceUpdate) && !isMaterial && isSA) {
      const latest = await getLatestBOMCost(item.component_code, item.drawing_no);
      if (latest.bom_cost > 0) {
        rate = latest.bom_cost;
      }
    }

    const weightPerUnit = parseFloat(item.weight_per_unit || 0);
    const scrapPercent = parseFloat(item.scrap_percent || 0);

    let baseItemCost = qty * rate;
    if ((isMaterial || isConsumable) && weightPerUnit > 0) {
      const sP = scrapPercent > 1 ? scrapPercent / 100 : scrapPercent;
      baseItemCost = qty * weightPerUnit * (1 + sP) * rate;
    }

    // Find children
    const children = allItems.filter(child => String(child.parent_id) === String(item.id));
    let childrenCost = 0;
    for (const child of children) {
      childrenCost += await calculateItemCost(child, allItems);
    }

    const totalBeforeLoss = baseItemCost + childrenCost;
    const lossPercent = isMaterial ? 0 : parseFloat(item.loss_percent || 0);

    return (lossPercent > 0 && lossPercent < 100)
      ? totalBeforeLoss / (1 - (lossPercent / 100))
      : totalBeforeLoss;
  };

  // 3. Sum up top-level costs
  let totalComponentsCost = 0;
  const topComponents = components.filter(c => !c.parent_id);
  for (const c of topComponents) {
    totalComponentsCost += await calculateItemCost(c, [...components, ...materials]);
  }

  let totalMaterialsCost = 0;
  const topMaterials = materials.filter(m => !m.parent_id);
  for (const m of topMaterials) {
    totalMaterialsCost += await calculateItemCost(m, [...components, ...materials]);
  }

  // 4. Scrap Loss
  const batchQty = parseFloat(parentItem.quantity || 1);
  
  let totalScrapLoss = 0;
  scrap.forEach(s => {
    const input = parseFloat(s.input_qty || 0);
    const loss = parseFloat(s.loss_percent || 0) / 100;
    const rate = parseFloat(s.rate || 0);
    totalScrapLoss += (input * loss * rate);
  });
  const scrapLossPerUnit = totalScrapLoss / batchQty;

  // 5. Operations Cost
  let totalOperationsCost = 0;
  operations.forEach(o => {
    const hourlyRate = parseFloat(o.hourly_rate || 0);
    const setupTime = parseFloat(o.setup_time_min || 0);
    const cycleTime = parseFloat(o.cycle_time_min || 0);
    // Amortize setup time over the entire batch
    const setupPerUnit = batchQty > 0 ? (setupTime / batchQty) : 0;
    totalOperationsCost += ((cycleTime + setupPerUnit) / 60 * hourlyRate);
  });

  const finalCost = (totalComponentsCost + totalMaterialsCost - scrapLossPerUnit) + totalOperationsCost;
  
  console.log(`[recalculateBOMCost] Recalculated cost for item ${itemId} (${parentItem.item_code}): ${finalCost}`);
    
    // Update the specific item version
    await pool.execute('UPDATE sales_order_items SET bom_cost = ?, updated_at = NOW() WHERE id = ?', [finalCost, itemId]);

    // Also update the rate in all component references to this item to ensure future recalculations are correct
    // CRITICAL: Only update the rate in LATEST or PENDING versions of parent BOMs to maintain snapshot integrity
    if (parentItem.item_code) {
      await pool.execute(`
        UPDATE sales_order_item_components 
        SET rate = ? 
        WHERE component_code = ? 
        AND (drawing_no = ? OR drawing_no IS NULL OR ? IS NULL)
        AND sales_order_item_id IN (
            SELECT id FROM sales_order_items 
            WHERE status NOT IN ('APPROVED', 'RELEASED', 'COMPLETED')
            OR id IN (
                SELECT max_id FROM (
                    SELECT MAX(id) as max_id 
                    FROM sales_order_items 
                    GROUP BY sales_order_id, IFNULL(bom_id, item_code)
                ) as t
            )
        )
      `, [finalCost, parentItem.item_code, parentItem.drawing_no, parentItem.drawing_no]);
    }

    // Also update all matching LATEST versions across all sales orders to keep lists in sync
    if (parentItem.item_code) {
      await pool.execute(`
        UPDATE sales_order_items 
        SET bom_cost = ?, updated_at = NOW()
        WHERE item_code = ? 
        AND (drawing_no = ? OR (drawing_no IS NULL AND ? IS NULL))
        AND id IN (
          SELECT max_id FROM (
            SELECT MAX(id) as max_id 
            FROM sales_order_items 
            GROUP BY sales_order_id, IFNULL(bom_id, item_code)
          ) as t
        )
      `, [finalCost, parentItem.item_code, parentItem.drawing_no, parentItem.drawing_no]);
    }

    // Also update all linked quotations with the new cost
    await syncQuotationCosts(itemId, finalCost);
  
  return finalCost;
};

/**
 * Finds and updates all parent BOMs that use this item as a component
 */
const propagateCostToParents = async (itemCode, drawingNo) => {
  if (!itemCode) return;
  console.log(`[Cost Propagation] Checking parents for: ${itemCode} (${drawingNo})`);
  
  // 1. Fetch the absolute latest cost for this item to ensure we propagate the most recent value
  const [itemData] = await pool.query(`
    SELECT bom_cost FROM sales_order_items 
    WHERE item_code = ? AND (drawing_no = ? OR (drawing_no IS NULL AND ? IS NULL)) 
    ORDER BY id DESC LIMIT 1
  `, [itemCode, drawingNo, drawingNo]);
  
  if (itemData.length === 0 || parseFloat(itemData[0].bom_cost) <= 0) {
    console.log(`[Cost Propagation] Skipping - no valid cost found for ${itemCode}`);
    return;
  }
  const currentCost = parseFloat(itemData[0].bom_cost);

  // 2. Update this item's rate in ALL parent component lists before recalculating parents
  // This ensures that when recalculateBOMCost(parent.id) is called, it uses the new rate.
  // We update even COMPLETED ones just in case (though recalculateBOMCost will skip them if not forced)
  await pool.execute(`
    UPDATE sales_order_item_components 
    SET rate = ? 
    WHERE component_code = ? 
    AND (drawing_no = ? OR drawing_no IS NULL OR ? IS NULL)
  `, [currentCost, itemCode, drawingNo, drawingNo]);

  // 3. Find all LATEST or ACTIVE versions of sales_order_items that use this component_code
  // We want to update any BOM that is currently "live" or is the latest draft/version.
  const [parents] = await pool.query(`
    SELECT DISTINCT soi.id, soi.item_code, soi.drawing_no, soi.status
    FROM sales_order_items soi
    JOIN sales_order_item_components soc ON soi.id = soc.sales_order_item_id
    WHERE soc.component_code = ?
    AND (soc.drawing_no = ? OR soc.drawing_no IS NULL OR ? IS NULL)
    AND (
      -- Update absolute latest version of any BOM
      soi.id IN (
        SELECT max_id FROM (
          SELECT MAX(id) as max_id 
          FROM sales_order_items 
          GROUP BY sales_order_id, IFNULL(bom_id, item_code)
        ) as t
      )
      OR 
      -- Also update anything that isn't fully completed/cancelled
      soi.status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED')
    )
  `, [itemCode, drawingNo, drawingNo]);

  console.log(`[Cost Propagation] Found ${parents.length} parent BOMs to update for ${itemCode}`);

  for (const parent of parents) {
    // We force update even if approved to ensure consistency, 
    // BUT recalculateBOMCost itself has logic to handle historical snapshots.
    // For this "Smart Sync", we pass forceUpdate=true for LATEST versions.
    const isLatest = true; // Query above already filters for latest or active
    const newCost = await recalculateBOMCost(parent.id, true);
    console.log(`[Cost Propagation] Updated parent ${parent.item_code} (ID: ${parent.id}) to new cost: ₹${newCost}`);
    
    // 4. Recurse upwards to grandparents
    if (parent.item_code) {
      await propagateCostToParents(parent.item_code, parent.drawing_no);
    }
  }
};

/**
 * Force-updates an item's cost across the system and propagates to parents
 */
const updateItemCostAndPropagate = async (itemCode, drawingNo, newCost) => {
  console.log(`[Service] Forcing cost update and propagation for ${itemCode} (${drawingNo}) to ₹${newCost}`);
  
  // 1. Update the latest version's cost in sales_order_items
  // This is the "source" for propagation
  await pool.execute(`
    UPDATE sales_order_items 
    SET bom_cost = ?, updated_at = NOW()
    WHERE item_code = ? 
    AND (drawing_no = ? OR (drawing_no IS NULL AND ? IS NULL))
    AND id IN (
      SELECT max_id FROM (
        SELECT MAX(id) as max_id 
        FROM sales_order_items 
        GROUP BY sales_order_id, IFNULL(bom_id, item_code)
      ) as t
    )
  `, [newCost, itemCode, drawingNo, drawingNo]);

  // 2. Propagate to parents (this will also update component rates and quotations)
  await propagateCostToParents(itemCode, drawingNo);
  
  // 3. Sync quotations for this item itself (since propagateCostToParents only does parents)
  const [matchingItems] = await pool.query(`
    SELECT id FROM sales_order_items 
    WHERE item_code = ? AND (drawing_no = ? OR (drawing_no IS NULL AND ? IS NULL)) 
    ORDER BY id DESC LIMIT 1
  `, [itemCode, drawingNo, drawingNo]);
  
  if (matchingItems.length > 0) {
    await syncQuotationCosts(matchingItems[0].id, newCost);
  }
};

/**
 * Updates all quotation requests linked to a specific BOM item or identity
 */
const syncQuotationCosts = async (itemId, bomCost) => {
  if (!itemId || bomCost === undefined) return;

  try {
    // 1. Fetch the identity of the BOM item
    const [bomItems] = await pool.query(
      'SELECT item_code, drawing_no, bom_id FROM sales_order_items WHERE id = ?',
      [itemId]
    );

    if (bomItems.length === 0) return;

    const { item_code, drawing_no, bom_id } = bomItems[0];

    // 2. Find all quotation requests linked to this identity
    // We update quotations that are NOT yet turned into POs (status != 'COMPLETED' or similar)
    // Actually, usually we update those in 'PENDING', 'SENT', 'ACCEPTED' status.
    const [qrs] = await pool.query(
      `SELECT qr.id, qr.item_qty, qr.profit_percentage, qr.gst_percentage 
       FROM quotation_requests qr
       LEFT JOIN sales_order_items soi ON qr.sales_order_item_id = soi.id
       WHERE (qr.sales_order_item_id = ? 
          OR (soi.bom_id = ? AND soi.bom_id IS NOT NULL)
          OR (LOWER(TRIM(soi.item_code)) = LOWER(TRIM(?)) AND LOWER(TRIM(soi.drawing_no)) = LOWER(TRIM(?)))
          OR (LOWER(TRIM(qr.drawing_no)) = LOWER(TRIM(?)) AND qr.drawing_no IS NOT NULL))
          AND qr.status NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED')`,
      [itemId, bom_id, item_code, drawing_no, drawing_no]
    );

    for (const qr of qrs) {
      const profit = parseFloat(qr.profit_percentage) || 0;
      const gst = parseFloat(qr.gst_percentage) || 18;
      const qty = parseFloat(qr.item_qty) || 1;
      
      const newRate = bomCost * (1 + profit / 100);
      const newTotalBase = newRate * qty;
      const newTotalInclGst = newTotalBase * (1 + gst / 100);

      await pool.execute(
        `UPDATE quotation_requests 
         SET total_amount = ?, received_amount = ?, sales_order_item_id = ?, updated_at = NOW() 
         WHERE id = ?`,
        [newTotalBase, newTotalInclGst, itemId, qr.id]
      );
    }
    
    if (qrs.length > 0) {
      console.log(`[syncQuotationCosts] Updated ${qrs.length} quotations for item ${item_code || drawing_no} with new cost ₹${bomCost}`);
    }
  } catch (error) {
    console.error('[syncQuotationCosts] Error:', error.message);
  }
};

module.exports = {
  getItemMaterials,
  getItemComponents,
  getItemOperations,
  getItemScrap,
  addItemMaterial,
  addComponent,
  addOperation,
  addScrap,
  updateItemMaterial,
  updateOperation,
  updateComponent,
  updateScrap,
  deleteItemMaterial,
  deleteComponent,
  deleteOperation,
  deleteScrap,
  getBOMBySalesOrder,
  getApprovedBOMs,
  createBOMRequest,
  deleteBOM,
  findAnyBOM,
  getBOMHistory,
  getLatestBOMCost,
  recalculateBOMCost,
  propagateCostToParents,
  updateItemCostAndPropagate
};
