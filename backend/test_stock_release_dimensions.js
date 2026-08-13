const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });
const stockService = require('./src/services/stockService');

async function test() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    console.log('--- Testing Stock Entry with Different Dimensions for Same Item Code ---');
    const testItemCode = 'RM-ALUMINUMSH-0001';

    // 1. Transaction 1: Dimension A (100x50x10) - Qty: 5
    await stockService.addStockLedgerEntry(
      testItemCode,
      'IN',
      5,
      'Test Doc',
      999,
      'TEST-001',
      {
        remarks: 'Test Dimension A',
        userId: 1,
        warehouse: 'TEST-WH',
        length: 100,
        width: 50,
        thickness: 10,
        materialName: 'aluminum sheet',
        materialType: 'RAW_MATERIAL'
      },
      connection
    );

    // 2. Transaction 2: Dimension B (200x80x15) - Qty: 8
    await stockService.addStockLedgerEntry(
      testItemCode,
      'IN',
      8,
      'Test Doc',
      1000,
      'TEST-002',
      {
        remarks: 'Test Dimension B',
        userId: 1,
        warehouse: 'TEST-WH',
        length: 200,
        width: 80,
        thickness: 15,
        materialName: 'aluminum sheet',
        materialType: 'RAW_MATERIAL'
      },
      connection
    );

    // 3. Transaction 3: Dimension A (100x50x10) again - Qty: 3
    await stockService.addStockLedgerEntry(
      testItemCode,
      'IN',
      3,
      'Test Doc',
      1001,
      'TEST-003',
      {
        remarks: 'Test Dimension A repeat',
        userId: 1,
        warehouse: 'TEST-WH',
        length: 100,
        width: 50,
        thickness: 10,
        materialName: 'aluminum sheet',
        materialType: 'RAW_MATERIAL'
      },
      connection
    );

    // Verify stock_balance rows for TEST-WH
    const [rows] = await connection.query(
      `SELECT id, item_code, material_name, warehouse, current_balance, length, width, thickness 
       FROM stock_balance 
       WHERE item_code = ? AND warehouse = 'TEST-WH'
       ORDER BY length ASC`,
      [testItemCode]
    );

    console.log('Stock balance records created for TEST-WH:');
    console.log(JSON.stringify(rows, null, 2));

    if (rows.length !== 2) {
      throw new Error(`FAILED: Expected 2 stock balance rows for different dimensions, found ${rows.length}`);
    }

    const rowA = rows.find(r => parseFloat(r.length) === 100);
    const rowB = rows.find(r => parseFloat(r.length) === 200);

    if (!rowA || parseFloat(rowA.current_balance) !== 8) {
      throw new Error(`FAILED: Dimension A balance should be 8 (5+3), got ${rowA?.current_balance}`);
    }

    if (!rowB || parseFloat(rowB.current_balance) !== 8) {
      throw new Error(`FAILED: Dimension B balance should be 8, got ${rowB?.current_balance}`);
    }

    if (rowA.item_code !== testItemCode || rowB.item_code !== testItemCode) {
      throw new Error(`FAILED: Item code mismatch! Both rows should use ${testItemCode}`);
    }

    console.log('SUCCESS: All checks passed! Different dimensions created separate stock rows with the SAME Item Code.');

    // Rollback test data
    await connection.rollback();
    console.log('Test transaction rolled back safely.');
  } catch (error) {
    await connection.rollback();
    console.error('TEST ERROR:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

const pool = require('./src/config/db');
test();
