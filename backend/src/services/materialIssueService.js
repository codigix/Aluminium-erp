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
        `INSERT INTO material_issue_items (issue_id, material_name, material_type, item_group, product_type, item_code, quantity, uom, warehouse)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [issueId, item.materialName, item.materialType, item.itemGroup || null, item.productType || null, item.itemCode || null, item.quantity, item.uom, item.warehouse]
      );
      
      // Deduct from stock
      // In this system, we identify stock by item_code if available, or material_name + type
      let itemIdentifier = item.itemCode;
      
      if (!itemIdentifier) {
        // Try to find item_code from stock_balance based on material_name and type
        const [stockRows] = await connection.query(
          'SELECT item_code FROM stock_balance WHERE material_name = ? AND material_type = ? LIMIT 1',
          [item.materialName, item.materialType]
        );
        if (stockRows.length > 0) {
          itemIdentifier = stockRows[0].item_code;
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
          item.materialName,
          item.materialType,
          item.itemGroup,
          item.productType
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
