const fs = require('fs');

const feFile = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
const linesFe = fs.readFileSync(feFile, 'utf8').split('\n');
console.log("--- setItems ---");
for(let i=0; i<linesFe.length; i++) {
  if (linesFe[i].includes('if (hasChanges)')) {
    for(let j=i; j<i+5; j++) console.log((j+1) + ": " + linesFe[j]);
    break;
  }
}

const dsFile = 'e:/codigix-project/Aluminium-erp/backend/src/services/drawingService.js';
const linesDs = fs.readFileSync(dsFile, 'utf8').split('\n');
console.log("--- drawingService.js ---");
for(let i=0; i<linesDs.length; i++) {
  if (linesDs[i].includes('const isDrawingOrSA')) {
    for(let j=i; j<i+10; j++) console.log((j+1) + ": " + linesDs[j]);
    break;
  }
}
