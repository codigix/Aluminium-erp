const pool = require('../config/db');
const stockService = require('./stockService');

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
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 1. Generate Issue Number
    const [countRows] = await connection.query('SELECT COUNT(*) as count FROM material_issues');
    const count = countRows[0].count + 1;
    const issueNumber = `MI-${new Date().getFullYear().toString().slice(-2)}-${count.toString().padStart(4, '0')}`;
    
    // 2. Create Material Issue header
    const [result] = await connection.execute(
      `INSERT INTO material_issues (issue_number, work_order_id, issued_by, remarks)
       VALUES (?, ?, ?, ?)`,
      [issueNumber, workOrderId, userId, remarks]
    );
    
    const issueId = result.insertId;
    
    // 3. Create items and deduct stock
    for (const item of items) {
      await connection.execute(
        `INSERT INTO material_issue_items (issue_id, material_name, material_type, item_code, quantity, uom, warehouse)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [issueId, item.materialName, item.materialType, item.itemCode || null, item.quantity, item.uom, item.warehouse]
      );
      
      // Deduct from stock
      // In this system, we identify stock by item_code if available, or material_name + type
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
      
      if (itemIdentifier) {
        await stockService.addStockLedgerEntry(
          itemIdentifier,
          'OUT',
          item.quantity,
          'MATERIAL_ISSUE',
          issueId,
          issueNumber,
          `Issued for Work Order ${workOrderId}`,
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
  listMaterialIssues,
  getMaterialIssueById,
  createMaterialIssue
};
