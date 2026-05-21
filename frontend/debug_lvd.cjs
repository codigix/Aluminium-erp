const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8').split('\n');

let start = 0;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('const loadVersionData = (versionData) => {')) start = i;
  if (start > 0 && i > start && i < start + 60) {
    if (lines[i].includes('sub_assemblies')) console.log((i+1) + ": " + lines[i]);
  }
}
