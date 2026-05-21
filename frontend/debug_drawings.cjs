const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8').split('\n');

for(let i=0; i<300; i++) {
  if (lines[i].includes('const fetch') && lines[i].includes('drawings')) {
    console.log((i+1) + ": " + lines[i]);
  }
  if (lines[i].includes('setDrawings(')) {
    console.log((i+1) + ": " + lines[i]);
  }
}
