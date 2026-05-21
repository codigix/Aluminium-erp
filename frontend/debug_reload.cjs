const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8').split('\n');

let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const saSum = savedSubAssemblies.reduce')) {
    start = i;
    break;
  }
}

if (start !== -1) {
  for (let i = start - 30; i < start + 30; i++) {
    console.log((i+1) + ': ' + lines[i]);
  }
} else {
  console.log("Not found.");
}
