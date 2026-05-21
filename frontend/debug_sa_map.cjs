const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8').split('\n');
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('sub_assemblies:') && lines[i].includes('map')) {
    console.log((i+1) + ": " + lines[i]);
  }
}
