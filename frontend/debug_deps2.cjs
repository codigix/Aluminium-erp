const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8').split('\n');

for(let i=240; i<300; i++) {
  if (lines[i] && lines[i].includes('items.map(')) {
    for(let j=i-5; j<i+5; j++) console.log((j+1) + ": " + lines[j]);
    break;
  }
}
