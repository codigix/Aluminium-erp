const stockService = require('./src/services/stockService');

async function test() {
  const balances = await stockService.getStockBalance(null, true); // forItemsMaster = true (Items Master view)
  const sheetBalances = balances.filter(b => b.item_code === 'RM-ALUMINUMSH-0001');
  console.log(`--- STOCK BALANCE ROWS FOR RM-ALUMINUMSH-0001 (aluminum sheet) --- Count: ${sheetBalances.length}`);
  sheetBalances.forEach(b => {
    console.log(`ItemCode: ${b.item_code} | Material: ${b.material_name} | Warehouse: ${b.warehouse} | Qty: ${b.current_balance} | Wt: ${b.current_weight} KG | Length: ${b.length}, Width: ${b.width}, Thickness: ${b.thickness}, OuterDia: ${b.outer_diameter}`);
  });

  const tubeBalances = balances.filter(b => b.item_code === 'RM-ALUMINUMSQ-0001');
  console.log(`\n--- STOCK BALANCE ROWS FOR RM-ALUMINUMSQ-0001 (aluminum squrae tube) --- Count: ${tubeBalances.length}`);
  tubeBalances.forEach(b => {
    console.log(`ItemCode: ${b.item_code} | Material: ${b.material_name} | Warehouse: ${b.warehouse} | Qty: ${b.current_balance} | Wt: ${b.current_weight} KG | Length: ${b.length}, Width: ${b.width}, Thickness: ${b.thickness}`);
  });

  process.exit(0);
}

test();
