const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8').split('\n');

for(let i=250; i<260; i++) {
  console.log((i+1) + ": " + lines[i]);
}
