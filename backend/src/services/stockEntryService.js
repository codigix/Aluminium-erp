const pool = require('../config/db');
const stockService = require('./stockService');


const getCorrectItemCode = async (item, connection) => {
  let itemCode = item.itemCode || item.item_code;

  const length = parseFloat(item.length || 0);
  const width = parseFloat(item.width || 0);
  const thickness = parseFloat(item.thickness || 0);
  const diameter = parseFloat(item.diameter || 0);
  const outerDiameter = parseFloat(item.outerDiameter || item.outer_diameter || 0);

  // 0. If we already have a specific item code that exists in stock_balance and matches name + dimensions, use it!
  if (itemCode && itemCode !== 'auto-generated') {
    const [existing] = await connection.query(
      `SELECT item_code, material_type FROM stock_balance 
       WHERE (item_code = ? OR drawing_no = ?) 
         AND LOWER(TRIM(material_name)) = LOWER(TRIM(?))
         AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)
       LIMIT 1`,
      [itemCode, itemCode, item.materialName || item.material_name, length, width, thickness, diameter, outerDiameter]
    );
    if (existing.length > 0) {
      if (existing[0].material_type) {
        item.materialType = existing[0].material_type;
      }
      return existing[0].item_code;
    }
  }

  if (item.materialName || item.material_name) {
    const matName = item.materialName || item.material_name;
    const matType = item.materialType || item.material_type;
    // 1. Try matching by name, material type, and dimensions
    const [sb] = await connection.query(
      `SELECT item_code FROM stock_balance 
       WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
         AND (material_type = ? OR UPPER(REPLACE(material_type, ' ', '_')) = UPPER(REPLACE(?, ' ', '_')))
         AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)
       LIMIT 1`,
      [matName, matType, matType, length, width, thickness, diameter, outerDiameter]
    );

    if (sb.length > 0) {
      return sb[0].item_code;
    }

    // 2. Try matching by name and dimensions only (more flexible type match)
    const [sbNameDims] = await connection.query(
      `SELECT item_code FROM stock_balance 
       WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
         AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
         AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)
       LIMIT 1`,
      [matName, length, width, thickness, diameter, outerDiameter]
    );

    if (sbNameDims.length > 0) {
      return sbNameDims[0].item_code;
    }
  }

  // 3. Fallback: If we have an item code, check if it exists in stock_balance with different dimensions.
  // If it does, we ignore it (isMismatch = true) so we generate a new unique code.
  let isMismatch = false;
  if (itemCode && itemCode !== 'auto-generated') {
    const [existing] = await connection.query(
      `SELECT item_code, length, width, thickness, diameter, outer_diameter FROM stock_balance 
       WHERE item_code = ? LIMIT 1`,
      [itemCode]
    );
    if (existing.length > 0) {
      const ext = existing[0];
      const hasDimensions = (parseFloat(ext.length || 0) > 0 || parseFloat(ext.width || 0) > 0 || parseFloat(ext.thickness || 0) > 0 || parseFloat(ext.diameter || 0) > 0 || parseFloat(ext.outer_diameter || 0) > 0);
      const incomingHasDimensions = (length > 0 || width > 0 || thickness > 0 || diameter > 0 || outerDiameter > 0);

      if (incomingHasDimensions && (!hasDimensions || itemCode.startsWith('RM-'))) {
        isMismatch = true;
      } else if (hasDimensions) {
        const lengthDiff = Math.abs(parseFloat(ext.length || 0) - length) >= 0.0001;
        const widthDiff = Math.abs(parseFloat(ext.width || 0) - width) >= 0.0001;
        const thicknessDiff = Math.abs(parseFloat(ext.thickness || 0) - thickness) >= 0.0001;
        const diameterDiff = Math.abs(parseFloat(ext.diameter || 0) - diameter) >= 0.0001;
        const outerDiameterDiff = Math.abs(parseFloat(ext.outer_diameter || 0) - outerDiameter) >= 0.0001;

        if (lengthDiff || widthDiff || thicknessDiff || diameterDiff || outerDiameterDiff) {
          isMismatch = true;
        }
      }
    }
  }

  if (itemCode && itemCode !== 'auto-generated' && !isMismatch) {
    return itemCode;
  }

  // 4. Fallback: Generate a standard item code and create a new master record in stock_balance
  const matName = item.materialName || item.material_name;
  const matType = item.materialType || item.material_type;
  if (matName) {
    const generatedCode = await stockService.generateItemCode(matName, matType);

    const normalizedType = (matType || '').toUpperCase().trim().replace(/ /g, '_');
    await connection.execute(
      `INSERT INTO stock_balance (
        item_code, material_name, material_type, unit, current_balance, valuation_rate,
        length, width, thickness, diameter, outer_diameter, density, weight_per_unit, shape_id, material_id
      ) VALUES (?, ?, ?, ?, 0.000, 0.00, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generatedCode,
        matName,
        normalizedType,
        item.uom || item.unit || 'NOS',
        length || null,
        width || null,
        thickness || null,
        diameter || null,
        outerDiameter || null,
        item.density || null,
        item.weightPerUnit || item.weight_per_unit || null,
        item.shapeId || item.shape_id || null,
        item.materialId || item.material_id || null
      ]
    );
    return generatedCode;
  }

  return itemCode;
};

const getAllStockEntries = async (filters = {}) => {
  let query = `
    SELECT se.*, 
           (
             SELECT GROUP_CONCAT(DISTINCT 
               COALESCE(
                 -- 1. Drawing from production plan linked to the item's mr_id
                 (
                   SELECT COALESCE(soi_inner.drawing_no, oi_inner.drawing_no, ppi_inner.item_code)
                   FROM material_requests mr_inner 
                   JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id
                   LEFT JOIN production_plan_items ppi_inner ON pp_inner.id = ppi_inner.plan_id
                   LEFT JOIN sales_order_items soi_inner ON ppi_inner.sales_order_item_id = soi_inner.id
                   LEFT JOIN order_items oi_inner ON ppi_inner.sales_order_item_id = oi_inner.id AND pp_inner.sales_order_id = oi_inner.order_id
                   WHERE mr_inner.id = poi_d.mr_id
                   LIMIT 1
                 ),
                 -- 2. BOM No from production plan linked to the item's mr_id
                 (
                   SELECT pp_inner.bom_no 
                   FROM material_requests mr_inner 
                   JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id 
                   WHERE mr_inner.id = poi_d.mr_id 
                   LIMIT 1
                 ),
                 -- 3. Drawing from sales order linked to the item
                 (
                   SELECT soi_inner.drawing_no 
                   FROM sales_order_items soi_inner 
                   WHERE soi_inner.sales_order_id = poi_d.sales_order_id 
                   LIMIT 1
                 ),
                 -- 4. Drawing No directly on the PO item
                 IF(poi_d.drawing_no IS NOT NULL AND poi_d.drawing_no != '' AND poi_d.drawing_no != poi_d.item_code, poi_d.drawing_no, NULL),
                 -- 5. Item Code directly on the PO item
                 poi_d.item_code
               )
               ORDER BY poi_d.id SEPARATOR ', '
             )
             FROM grn_items gi_d
             JOIN purchase_order_items poi_d ON gi_d.po_item_id = poi_d.id
             WHERE gi_d.grn_id = se.grn_id
           ) as drawing_no,
           COALESCE(
             (
               SELECT ppi_inner.description 
               FROM grns g_inner
               JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number
               JOIN material_requests mr_inner ON po_inner.mr_id = mr_inner.id
               JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id 
               JOIN production_plan_items ppi_inner ON pp_inner.id = ppi_inner.plan_id 
               WHERE g_inner.id = se.grn_id 
               LIMIT 1
             ),
             (
               SELECT soi_inner.description 
               FROM grns g_inner
               JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number
               JOIN sales_order_items soi_inner ON po_inner.sales_order_id = soi_inner.sales_order_id
               WHERE g_inner.id = se.grn_id 
               LIMIT 1
             )
           ) as finished_good,
           (
             SELECT po_inner.po_number 
             FROM grns g_inner 
             JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number 
             WHERE g_inner.id = se.grn_id 
             LIMIT 1
           ) as po_number,
           (
             SELECT v.vendor_name 
             FROM grns g_inner 
             JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number 
             JOIN vendors v ON po_inner.vendor_id = v.id
             WHERE g_inner.id = se.grn_id 
             LIMIT 1
           ) as vendor_name,
           (
             SELECT COALESCE(
               (SELECT so.project_name FROM sales_orders so WHERE so.id = po_inner.sales_order_id AND so.is_sales_order = 1),
               (SELECT o.project_name FROM orders o WHERE o.id = po_inner.sales_order_id AND o.source_type = 'DIRECT'),
               'Stock/Internal'
             )
             FROM grns g_inner 
             JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number 
             WHERE g_inner.id = se.grn_id 
             LIMIT 1
           ) as project_name,
           (
             SELECT COALESCE(
               (SELECT c.company_name FROM companies c JOIN sales_orders so ON c.id = so.company_id WHERE so.id = po_inner.sales_order_id),
               (SELECT c.company_name FROM companies c JOIN orders o ON c.id = o.client_id WHERE o.id = po_inner.sales_order_id AND o.source_type = 'DIRECT'),
               'Internal'
             )
             FROM grns g_inner 
             JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number 
             WHERE g_inner.id = se.grn_id 
             LIMIT 1
           ) as client_name,
           (
             SELECT GROUP_CONCAT(sei.item_code) 
             FROM stock_entry_items sei 
             WHERE sei.stock_entry_id = se.id
           ) as material_ids,
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

  // Get item counts and total value for each entry in a single batched query
  if (rows.length > 0) {
    const entryIds = rows.map(r => r.id);
    const [statsRows] = await pool.query(
      'SELECT stock_entry_id, COUNT(*) as count, SUM(amount) as total_value FROM stock_entry_items WHERE stock_entry_id IN (?) GROUP BY stock_entry_id',
      [entryIds]
    );
    const statsMap = {};
    for (const s of statsRows) {
      statsMap[s.stock_entry_id] = s;
    }
    for (const row of rows) {
      const stats = statsMap[row.id];
      row.item_count = stats ? (stats.count || 0) : 0;
      row.total_value = stats ? (stats.total_value || 0) : 0;
    }
  }

  return rows;
};

const getStockEntryById = async (id) => {
  const [rows] = await pool.query(
    `SELECT se.*, 
            (
              SELECT GROUP_CONCAT(DISTINCT 
                COALESCE(
                  -- 1. Drawing from production plan linked to the item's mr_id
                  (
                    SELECT COALESCE(soi_inner.drawing_no, oi_inner.drawing_no, ppi_inner.item_code)
                    FROM material_requests mr_inner 
                    JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id
                    LEFT JOIN production_plan_items ppi_inner ON pp_inner.id = ppi_inner.plan_id
                    LEFT JOIN sales_order_items soi_inner ON ppi_inner.sales_order_item_id = soi_inner.id
                    LEFT JOIN order_items oi_inner ON ppi_inner.sales_order_item_id = oi_inner.id AND pp_inner.sales_order_id = oi_inner.order_id
                    WHERE mr_inner.id = poi_d.mr_id
                    LIMIT 1
                  ),
                  -- 2. BOM No from production plan linked to the item's mr_id
                  (
                    SELECT pp_inner.bom_no 
                    FROM material_requests mr_inner 
                    JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id 
                    WHERE mr_inner.id = poi_d.mr_id 
                    LIMIT 1
                  ),
                  -- 3. Drawing from sales order linked to the item
                  (
                    SELECT soi_inner.drawing_no 
                    FROM sales_order_items soi_inner 
                    WHERE soi_inner.sales_order_id = poi_d.sales_order_id 
                    LIMIT 1
                  ),
                  -- 4. Drawing No directly on the PO item
                  IF(poi_d.drawing_no IS NOT NULL AND poi_d.drawing_no != '' AND poi_d.drawing_no != poi_d.item_code, poi_d.drawing_no, NULL),
                  -- 5. Item Code directly on the PO item
                  poi_d.item_code
                )
                ORDER BY poi_d.id SEPARATOR ', '
              )
              FROM grn_items gi_d
              JOIN purchase_order_items poi_d ON gi_d.po_item_id = poi_d.id
              WHERE gi_d.grn_id = se.grn_id
            ) as drawing_no,
            COALESCE(
              (
                SELECT ppi_inner.description 
                FROM grns g_inner
                JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number
                JOIN material_requests mr_inner ON po_inner.mr_id = mr_inner.id
                JOIN production_plans pp_inner ON mr_inner.plan_id = pp_inner.id 
                JOIN production_plan_items ppi_inner ON pp_inner.id = ppi_inner.plan_id 
                WHERE g_inner.id = se.grn_id 
                LIMIT 1
              ),
              (
                SELECT soi_inner.description 
                FROM grns g_inner
                JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number
                JOIN sales_order_items soi_inner ON po_inner.sales_order_id = soi_inner.sales_order_id
                WHERE g_inner.id = se.grn_id 
                LIMIT 1
              )
            ) as finished_good,
            (
              SELECT po_inner.po_number 
              FROM grns g_inner 
              JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number 
              WHERE g_inner.id = se.grn_id 
              LIMIT 1
            ) as po_number,
            (
              SELECT v.vendor_name 
              FROM grns g_inner 
              JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number 
              JOIN vendors v ON po_inner.vendor_id = v.id
              WHERE g_inner.id = se.grn_id 
              LIMIT 1
            ) as vendor_name,
            (
              SELECT COALESCE(
                (SELECT so.project_name FROM sales_orders so WHERE so.id = po_inner.sales_order_id AND so.is_sales_order = 1),
                (SELECT o.project_name FROM orders o WHERE o.id = po_inner.sales_order_id AND o.source_type = 'DIRECT'),
                'Stock/Internal'
              )
              FROM grns g_inner 
              JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number 
              WHERE g_inner.id = se.grn_id 
              LIMIT 1
            ) as project_name,
            (
              SELECT COALESCE(
                (SELECT c.company_name FROM companies c JOIN sales_orders so ON c.id = so.company_id WHERE so.id = po_inner.sales_order_id),
                (SELECT c.company_name FROM companies c JOIN orders o ON c.id = o.client_id WHERE o.id = po_inner.sales_order_id AND o.source_type = 'DIRECT'),
                'Internal'
              )
              FROM grns g_inner 
              JOIN purchase_orders po_inner ON g_inner.po_number = po_inner.po_number 
              WHERE g_inner.id = se.grn_id 
              LIMIT 1
            ) as client_name,
            (
              SELECT GROUP_CONCAT(sei.item_code) 
              FROM stock_entry_items sei 
              WHERE sei.stock_entry_id = se.id
            ) as material_ids,
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
        const correctedItemCode = await getCorrectItemCode(item, connection);
        await connection.execute(
          `INSERT INTO stock_entry_items 
           (stock_entry_id, item_code, material_name, material_type, quantity, uom, batch_no, valuation_rate, amount,
            shape_id, length, width, thickness, diameter, outer_diameter, weight_per_unit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entryId,
            correctedItemCode,
            item.materialName || null,
            item.materialType || null,
            item.quantity,
            item.uom || null,
            item.batchNo || null,
            item.valuationRate || 0,
            (item.quantity * (item.valuationRate || 0)),
            item.shapeId || null,
            item.length || null,
            item.width || null,
            item.thickness || null,
            item.diameter || null,
            item.outerDiameter || null,
            item.weightPerUnit || null
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
    const weightPerUnit = parseFloat(item.weight_per_unit || 0);
    const isKg = (item.uom || '').toLowerCase() === 'kg' || (item.uom || '').toLowerCase() === 'kgs' || (item.uom || '').toLowerCase() === 'kilogram';
    let totalWeight = 0;
    if (weightPerUnit > 0) {
      totalWeight = weightPerUnit * Math.abs(parseFloat(item.quantity || 0));
    } else if (isKg) {
      totalWeight = Math.abs(parseFloat(item.quantity || 0));
    }

    const ledgerOptions = {
      connection,
      warehouse: toWarehouseName || fromWarehouseName,
      valuationRate: item.valuation_rate,
      materialName: item.material_name,
      materialType: item.material_type,
      unit: item.uom,
      weight: totalWeight,
      // Dimension fields for dimension-wise stock balance tracking
      shape_id: item.shape_id || null,
      shape_type: item.shape_type || null,
      length: item.length !== null && item.length !== undefined ? parseFloat(item.length) : undefined,
      width: item.width !== null && item.width !== undefined ? parseFloat(item.width) : undefined,
      thickness: item.thickness !== null && item.thickness !== undefined ? parseFloat(item.thickness) : undefined,
      diameter: item.diameter !== null && item.diameter !== undefined ? parseFloat(item.diameter) : undefined,
      outer_diameter: item.outer_diameter !== null && item.outer_diameter !== undefined ? parseFloat(item.outer_diameter) : undefined,
      density: item.density !== null && item.density !== undefined ? parseFloat(item.density) : undefined,
      weight_per_unit: item.weight_per_unit !== null && item.weight_per_unit !== undefined ? parseFloat(item.weight_per_unit) : undefined
    };

    // Fallback: If dimensions are missing from stock_entry_item but entry has grn_id, fetch from grn_items
    if (entry.grn_id && (ledgerOptions.length === undefined || ledgerOptions.width === undefined)) {
      const [grnItemDims] = await connection.query(`
        SELECT gi.length, gi.width, gi.thickness, gi.diameter, gi.outer_diameter, gi.density, gi.weight_per_unit, COALESCE(gi.shape_type, poi.shape_type) as shape_type
        FROM grn_items gi
        LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
        LEFT JOIN qc_inspection_items qci ON qci.grn_item_id = gi.id
        WHERE gi.grn_id = ? AND (COALESCE(qci.item_code, poi.item_code) = ? OR gi.po_item_id IN (SELECT id FROM purchase_order_items WHERE item_code = ?))
        LIMIT 1
      `, [entry.grn_id, item.item_code, item.item_code]);

      if (grnItemDims.length > 0) {
        const d = grnItemDims[0];
        if (d.length !== null && d.length !== undefined) ledgerOptions.length = parseFloat(d.length);
        if (d.width !== null && d.width !== undefined) ledgerOptions.width = parseFloat(d.width);
        if (d.thickness !== null && d.thickness !== undefined) ledgerOptions.thickness = parseFloat(d.thickness);
        if (d.diameter !== null && d.diameter !== undefined) ledgerOptions.diameter = parseFloat(d.diameter);
        if (d.outer_diameter !== null && d.outer_diameter !== undefined) ledgerOptions.outer_diameter = parseFloat(d.outer_diameter);
        if (d.density !== null && d.density !== undefined) ledgerOptions.density = parseFloat(d.density);
        if (d.weight_per_unit !== null && d.weight_per_unit !== undefined) ledgerOptions.weight_per_unit = parseFloat(d.weight_per_unit);
        if (d.shape_type) ledgerOptions.shape_type = d.shape_type;
      }
    }

    if (entry.entry_type === 'Material Receipt') {
      ledgerOptions.warehouse = toWarehouseName;
      ledgerOptions.connection = connection;
      await stockService.addStockLedgerEntry(
        item.item_code,
        'IN',
        item.quantity,
        'STOCK_ENTRY',
        entry.id,
        entry.entry_no,
        `Receipt into ${toWarehouseName || 'Warehouse'}. ${entry.remarks || ''}`,
        userId,
        ledgerOptions
      );
    } else if (entry.entry_type === 'Material Issue') {
      ledgerOptions.warehouse = fromWarehouseName;
      ledgerOptions.connection = connection;
      await stockService.addStockLedgerEntry(
        item.item_code,
        'OUT',
        item.quantity,
        'STOCK_ENTRY',
        entry.id,
        entry.entry_no,
        `Issue from ${fromWarehouseName || 'Warehouse'}. ${entry.remarks || ''}`,
        userId,
        ledgerOptions
      );
    } else if (entry.entry_type === 'Material Transfer') {
      // OUT from source
      const outOptions = { ...ledgerOptions, warehouse: fromWarehouseName, connection };
      await stockService.addStockLedgerEntry(
        item.item_code,
        'OUT',
        item.quantity,
        'STOCK_ENTRY',
        entry.id,
        entry.entry_no,
        `Transfer from ${fromWarehouseName} to ${toWarehouseName}`,
        userId,
        outOptions
      );
      // IN to destination
      const inOptions = { ...ledgerOptions, warehouse: toWarehouseName, connection };
      await stockService.addStockLedgerEntry(
        item.item_code,
        'IN',
        item.quantity,
        'STOCK_ENTRY',
        entry.id,
        entry.entry_no,
        `Transfer from ${fromWarehouseName} to ${toWarehouseName}`,
        userId,
        inOptions
      );
    } else if (entry.entry_type === 'Material Adjustment') {
      const type = item.quantity >= 0 ? 'IN' : 'OUT';
      ledgerOptions.connection = connection;
      await stockService.addStockLedgerEntry(
        item.item_code,
        type === 'IN' ? 'ADJUSTMENT' : 'OUT',
        Math.abs(item.quantity),
        'STOCK_ENTRY',
        entry.id,
        entry.entry_no,
        `Adjustment in ${fromWarehouseName || toWarehouseName || 'Warehouse'}. ${entry.remarks || ''}`,
        userId,
        ledgerOptions
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
      COALESCE(qci.item_code, poi.item_code) as item_code,
      gi.id as grn_item_id,
      COALESCE(gi.received_qty, gi.accepted_qty, 0) as quantity,
      COALESCE(poi.unit, gi.uom, 'NOS') as uom,
      COALESCE(poi.unit_rate, 0) as valuation_rate,
      poi.material_type,
      poi.material_name,
      gi.length,
      gi.width,
      gi.thickness,
      gi.diameter,
      gi.outer_diameter,
      gi.density,
      COALESCE(gi.weight_per_unit, gi.received_weight, poi.required_weight, 0) as weight_per_unit,
      COALESCE(gi.shape_type, poi.shape_type) as shape_type
    FROM grn_items gi
    LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
    LEFT JOIN qc_inspection_items qci ON qci.grn_item_id = gi.id
    WHERE gi.grn_id = ?
  `, [grnId]);

  // For all items, try to find the "correct" item_code from stock_balance by matching name + dimensions
  for (const item of items) {
    if (item.material_name) {
      const length = item.length || 0;
      const width = item.width || 0;
      const thickness = item.thickness || 0;
      const diameter = item.diameter || 0;
      const outerDiameter = item.outer_diameter || 0;

      // 0. If we already have a specific item code that exists in stock_balance and matches name + dimensions, use it!
      // We prioritize the one already in the item object (which might come from QC)
      if (item.item_code && item.item_code !== 'auto-generated') {
        const [existing] = await executor.query(
          `SELECT item_code, material_type FROM stock_balance 
           WHERE (item_code = ? OR drawing_no = ?) 
             AND LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
             AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
             AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
             AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
             AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
             AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)
           LIMIT 1`,
          [item.item_code, item.item_code, item.material_name, length, width, thickness, diameter, outerDiameter]
        );
        if (existing.length > 0) {
          item.item_code = existing[0].item_code;
          if (existing[0].material_type) {
            item.material_type = existing[0].material_type;
          }
          continue; // Move to next item
        }
      }

      // 1. Try matching by name, material type, and dimensions
      const [sb] = await executor.query(
        `SELECT item_code FROM stock_balance 
         WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
           AND (material_type = ? OR UPPER(REPLACE(material_type, ' ', '_')) = UPPER(REPLACE(?, ' ', '_')))
           AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
           AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
           AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
           AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
           AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)
         LIMIT 1`,
        [item.material_name, item.material_type, item.material_type, length, width, thickness, diameter, outerDiameter]
      );

      if (sb.length > 0) {
        item.item_code = sb[0].item_code;
      } else {
        // 2. Try matching by name and dimensions only (more flexible type match)
        const [sbNameDims] = await executor.query(
          `SELECT item_code FROM stock_balance 
           WHERE LOWER(TRIM(material_name)) = LOWER(TRIM(?)) 
             AND (ABS(COALESCE(length, 0) - COALESCE(?, 0)) < 0.0001)
             AND (ABS(COALESCE(width, 0) - COALESCE(?, 0)) < 0.0001)
             AND (ABS(COALESCE(thickness, 0) - COALESCE(?, 0)) < 0.0001)
             AND (ABS(COALESCE(diameter, 0) - COALESCE(?, 0)) < 0.0001)
             AND (ABS(COALESCE(outer_diameter, 0) - COALESCE(?, 0)) < 0.0001)
           LIMIT 1`,
          [item.material_name, length, width, thickness, diameter, outerDiameter]
        );

        if (sbNameDims.length > 0) {
          item.item_code = sbNameDims[0].item_code;
        } else {
          let resolvedShapeId = null;
          const shapeName = item.shape_type;
          if (shapeName) {
            const [shapeRows] = await executor.query(
              'SELECT id FROM shapes WHERE name = ? LIMIT 1',
              [shapeName]
            );
            if (shapeRows.length > 0) {
              resolvedShapeId = shapeRows[0].id;
            }
          }

          const generatedCode = await stockService.generateItemCode(item.material_name, item.material_type);

          const normalizedType = (item.material_type || '').toUpperCase().trim().replace(/ /g, '_');
          await executor.execute(
            `INSERT INTO stock_balance (
              item_code, material_name, material_type, unit, current_balance, valuation_rate,
              length, width, thickness, diameter, outer_diameter, density, weight_per_unit, shape_id, material_id
            ) VALUES (?, ?, ?, ?, 0.000, 0.00, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              generatedCode,
              item.material_name,
              normalizedType,
              item.uom || 'NOS',
              item.length || null,
              item.width || null,
              item.thickness || null,
              item.diameter || null,
              item.outer_diameter || null,
              item.density || null,
              item.weight_per_unit || null,
              resolvedShapeId,
              item.material_id || null
            ]
          );
          item.item_code = generatedCode;
        }
      }
    } else if (!item.item_code) {
      item.item_code = `ITEM-${item.grn_item_id}`;
    }
  }

  // Filter out items without item_code and filter by type
  return items.filter(item => {
    if (!item.item_code) return false;
    const type = (item.material_type || '').toUpperCase();
    return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
  });
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
    const allItems = await getStockEntryItemsFromGRN(grnId, connection);

    // Filter items with positive quantity
    const items = allItems.filter(item => parseFloat(item.quantity) > 0);

    if (items.length === 0) {
      console.warn(`[StockEntry] No items with positive quantity found for GRN: ${grnId}. Skipping stock entry creation.`);
      if (shouldCommit) await connection.rollback();
      return { success: false, message: 'No items with positive quantity in GRN' };
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
        `Auto-created from GRN ${grn.po_number || ''}`,
        userId,
        'submitted'
      ]
    );

    const entryId = result.insertId;

    // 5. Create Stock Entry Items
    for (const item of items) {
      let shapeId = item.shape_id || null;
      if (!shapeId && item.shape_type) {
        const [shapeRows] = await connection.query(
          'SELECT id FROM shapes WHERE name = ? OR LOWER(name) = LOWER(?) LIMIT 1',
          [item.shape_type, item.shape_type]
        );
        if (shapeRows.length > 0) shapeId = shapeRows[0].id;
      }

      await connection.execute(
        `INSERT INTO stock_entry_items 
         (stock_entry_id, item_code, material_name, material_type, quantity, uom, valuation_rate, amount,
          length, width, thickness, diameter, outer_diameter, density, weight_per_unit, shape_id, shape_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entryId,
          item.item_code,
          item.material_name || null,
          item.material_type || null,
          item.quantity,
          item.uom || 'NOS',
          item.valuation_rate || 0,
          (parseFloat(item.quantity) * parseFloat(item.valuation_rate || 0)),
          item.length || null,
          item.width || null,
          item.thickness || null,
          item.diameter || null,
          item.outer_diameter || null,
          item.density || null,
          item.weight_per_unit || null,
          shapeId,
          item.shape_type || null
        ]
      );
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

const updateStockEntry = async (id, data, userId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [entries] = await connection.query('SELECT * FROM stock_entries WHERE id = ?', [id]);
    if (entries.length === 0) throw new Error('Stock Entry not found');
    const oldEntry = entries[0];

    // 1. If old entry was submitted, reverse the stock ledger entries first
    if (oldEntry.status === 'submitted') {
      const [ledgerEntries] = await connection.query(
        'SELECT id FROM stock_ledger WHERE reference_doc_type = "STOCK_ENTRY" AND reference_doc_id = ?',
        [id]
      );
      for (const le of ledgerEntries) {
        await stockService.deleteStockLedgerEntry(le.id, connection);
      }
    }

    // 2. Update stock entry details
    await connection.execute(
      `UPDATE stock_entries 
       SET entry_type = ?, purpose = ?, from_warehouse_id = ?, to_warehouse_id = ?, entry_date = ?, grn_id = ?, remarks = ?, status = ?
       WHERE id = ?`,
      [
        data.entryType || oldEntry.entry_type,
        data.purpose || null,
        data.fromWarehouseId || null,
        data.toWarehouseId || null,
        data.entryDate || oldEntry.entry_date,
        data.grnId || null,
        data.remarks || null,
        data.status || 'draft',
        id
      ]
    );

    // 3. Delete existing items
    await connection.execute('DELETE FROM stock_entry_items WHERE stock_entry_id = ?', [id]);

    // 4. Insert new items
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const correctedItemCode = await getCorrectItemCode(item, connection);
        await connection.execute(
          `INSERT INTO stock_entry_items 
           (stock_entry_id, item_code, material_name, material_type, quantity, uom, batch_no, valuation_rate, amount,
            shape_id, length, width, thickness, diameter, outer_diameter, weight_per_unit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            correctedItemCode,
            item.materialName || item.material_name || null,
            item.materialType || item.material_type || null,
            item.quantity,
            item.uom || null,
            item.batchNo || item.batch_no || null,
            item.valuationRate || item.valuation_rate || 0,
            (item.quantity * (item.valuationRate || item.valuation_rate || 0)),
            item.shapeId || item.shape_id || null,
            item.length || null,
            item.width || null,
            item.thickness || null,
            item.diameter || null,
            item.outerDiameter || item.outer_diameter || null,
            item.weightPerUnit || item.weight_per_unit || null
          ]
        );
      }
    }

    // 5. If new status is submitted, process stock movement
    if (data.status === 'submitted') {
      await processStockMovement(id, connection, userId);
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

module.exports = {
  getAllStockEntries,
  getStockEntryById,
  createStockEntry,
  updateStockEntry,
  submitStockEntry,
  deleteStockEntry,
  getStockEntryItemsFromGRN,
  autoCreateStockEntryFromGRN
};
