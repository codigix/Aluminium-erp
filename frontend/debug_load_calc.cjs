const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8').split('\n');

let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// For NEW revisions, we might want to recalculate based on updated sub-assemblies, materials and operations')) {
    start = i;
  }
  if (start !== -1 && lines[i].includes('return {') && i > start + 10) {
    end = i;
    break;
  }
}

if (start !== -1) {
  for (let i = start - 1; i <= end; i++) {
    console.log((i+1) + ": " + lines[i]);
  }
} else {
  console.log("Could not find the target block");
}
