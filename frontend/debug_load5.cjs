const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8').split('\n');
for(let i=510; i<560; i++) {
  if (lines[i] !== undefined) {
    console.log((i+1) + ": " + lines[i]);
  }
}
