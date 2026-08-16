const stockService = require('./src/services/stockService');

async function test() {
  console.log('--- TESTING STOCK LEDGER DIMENSIONS ---');
  const ledger = await stockService.getStockLedger();

  console.log(`Total ledger entries fetched: ${ledger.length}`);

  const sampleEntries = ledger.slice(0, 15);
  sampleEntries.forEach(entry => {
    console.log(
      `ID: ${entry.id} | Code: ${entry.item_code} | Name: ${entry.material_name} | Type: ${entry.transaction_type} | Qty: ${entry.quantity} | ` +
      `Length: ${entry.length}, Width: ${entry.width}, Thickness: ${entry.thickness}, Diameter: ${entry.diameter}, OuterDia: ${entry.outer_diameter}`
    );
  });

  process.exit(0);
}

test();
