const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8').split('\n');

console.log("--- hasChanges ---");
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('const hasChanges =')) {
    for(let j=i; j<i+10; j++) console.log((j+1) + ": " + lines[j]);
    break;
  }
}

console.log("--- useEffect deps ---");
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('items.map(i => `${i.id}')) {
    for(let j=i-5; j<i+5; j++) console.log((j+1) + ": " + lines[j]);
    break;
  }
}
