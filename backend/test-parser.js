const parseExcelPo = require('./src/utils/excelPoParser');
const fs = require('fs');

async function test() {
  const file = fs.readFileSync('c:/Aluminium-erp/frontend/src/assets/SP-PO0191 excel (1).xls');
  const result = await parseExcelPo(file);
  console.log('Parsed Result:');
  console.log('\nHeader:');
  console.log(JSON.stringify(result.header, null, 2));
  console.log('\nItems:');
  console.log(JSON.stringify(result.items, null, 2));
}

test();
