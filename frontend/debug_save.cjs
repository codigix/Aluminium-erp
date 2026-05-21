const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8').split('\n');
let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const handleSave = async')) {
    start = i;
    break;
  }
}
if (start !== -1) {
  for (let i = start; i < start + 50; i++) {
    console.log((i+1) + ": " + lines[i]);
  }
}
