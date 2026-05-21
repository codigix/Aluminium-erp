const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('.sub_assemblies =')) {
    console.log(`Line ${i+1}: ${lines[i].trim()}`);
  }
}
