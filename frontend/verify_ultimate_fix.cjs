const fs = require('fs');
const fe = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8');
const be = fs.readFileSync('e:/codigix-project/Aluminium-erp/backend/src/controllers/quotationRequestController.js', 'utf8');

console.log('FE contains old sub_assemblies:', fe.includes('sub_assemblies: item.sub_assemblies || []'));
console.log('FE contains old calculateSummary FG:', fe.includes(`includes('FG')`));
console.log('BE contains old sub_assemblies mapping:', be.includes('isAssembly ? components : components.filter'));
