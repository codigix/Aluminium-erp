const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8').split('\n');

console.log("--- sub_assemblies assignment ---");
for(let i=1325; i<1345; i++) console.log((i+1) + ": " + lines[i]);

console.log("--- calculateSummary ---");
for(let i=780; i<795; i++) console.log((i+1) + ": " + lines[i]);

console.log("--- span PART ---");
for(let i=1420; i<1445; i++) console.log((i+1) + ": " + lines[i]);
