const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('sub_assemblies')) {
    if (lines[i].includes('push') || lines[i].includes('...')) {
      console.log(`Line ${i+1}: ${lines[i].trim()}`);
      for(let j=Math.max(0, i-2); j<i; j++) console.log(`  ${j+1}: ${lines[j].trim()}`);
    }
  }
}
