const XLSX = require('xlsx');
const fs = require('fs');

const file = fs.readFileSync('c:/Aluminium-erp/frontend/src/assets/SP-PO0191 excel (1).xls');
const wb = XLSX.read(file);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

console.log('Sheet names:', wb.SheetNames);
console.log('Columns:', Object.keys(data[0] || {}));
console.log('Number of rows:', data.length);
console.log('\nFirst 3 rows:');
data.slice(0, 3).forEach((row, idx) => {
  console.log(`\nRow ${idx}:`, JSON.stringify(row, null, 2));
});
