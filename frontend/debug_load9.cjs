const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8').split('\n');
for(let i=150; i<180; i++) {
  if (lines[i] !== undefined) {
    console.log((i+1) + ": " + lines[i]);
  }
}
