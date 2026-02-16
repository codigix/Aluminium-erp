const pool = require('./backend/src/config/db');

async function refreshAllBalances() {
  console.log('Refreshing all stock balances from ledger...');
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1. Get all unique items from ledger
    const [items] = await connection.query('SELECT DISTINCT item_code FROM stock_ledger');
    console.log(`Found ${items.length} items in ledger.`);
    
    for (const item of items) {
      const itemCode = item.item_code;
      
      // Calculate total balance from ledger
      const [ledgerData] = await connection.query(`
        SELECT 
          SUM(qty_in - qty_out) as current_balance,
          MAX(material_name) as material_name,
          MAX(material_type) as material_type,
          MAX(warehouse) as warehouse
        FROM stock_ledger 
        WHERE item_code = ?
      `, [itemCode]);
      
      const balance = parseFloat(ledgerData[0].current_balance) || 0;
      const matName = ledgerData[0].material_name;
      const matType = ledgerData[0].material_type;
      const warehouse = ledgerData[0].warehouse;
      
      console.log(`Updating ${itemCode}: Balance = ${balance}`);
      
      // Update stock_balance using the new UPSERT logic pattern
      await connection.execute(`
        INSERT INTO stock_balance 
        (item_code, material_name, material_type, warehouse, current_balance, last_updated)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE 
          current_balance = VALUES(current_balance),
          last_updated = CURRENT_TIMESTAMP
      `, [itemCode, matName, matType, warehouse, balance]);
    }
    
    console.log('Balance refresh completed successfully.');
  } catch (error) {
    console.error('Refresh failed:', error);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

refreshAllBalances();
