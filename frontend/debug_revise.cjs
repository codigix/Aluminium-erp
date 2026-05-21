const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/backend/src/controllers/quotationRequestController.js', 'utf8').split('\n');

let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const reviseQuotation')) {
    start = i;
  }
}
if (start !== -1) {
  for (let i = start; i < start + 200; i++) {
    if (lines[i] && (lines[i].includes('sub_assemblies') || lines[i].includes('bom_cost') || lines[i].includes('item'))) {
      console.log((i+1) + ": " + lines[i].trim());
    }
  }
}
