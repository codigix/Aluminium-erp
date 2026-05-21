const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('Current BOM Cost') || lines[i].includes('New BOM Cost') || lines[i].includes('Pending BOM Update')) {
    console.log(`Line ${i+1}: ${lines[i].trim()}`);
    for(let j=Math.max(0, i-5); j<=i+5; j++) {
      if (lines[j]) console.log(`  ${j+1}: ${lines[j].trim()}`);
    }
    console.log('---');
  }
}
