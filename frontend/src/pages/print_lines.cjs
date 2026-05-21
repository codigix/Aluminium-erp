const fs = require('fs');
const code = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8');
const lines = code.split('\n');
for (let i = 1110; i < 1120; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
