const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/backend/src/controllers/quotationRequestController.js', 'utf8').split('\n');
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('.map') && lines[i].includes('bom_cost')) {
    console.log((i+1) + ": " + lines[i].trim());
  }
}
