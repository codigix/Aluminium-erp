const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

let inTable = false;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('<tbody>')) {
    inTable = true;
  }
  if (inTable) {
    if (lines[i].includes('item.sub_assemblies') || lines[i].includes('nestedItems') || lines[i].includes('components')) {
      console.log(`Line ${i+1}: ${lines[i].trim()}`);
    }
  }
}
