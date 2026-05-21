const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

for(let i=1100; i<1500; i++) {
  if (lines[i] !== undefined && lines[i].includes('sub_assemblies')) {
    console.log(`Line ${i+1}: ${lines[i].trim()}`);
    for(let j=i+1; j<=i+10; j++) {
      if (lines[j]) console.log(`Line ${j+1}: ${lines[j].trim()}`);
    }
  }
}
