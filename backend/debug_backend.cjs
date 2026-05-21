const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/backend/src/controllers/quotationRequestController.js';
const lines = fs.readFileSync(file, 'utf8').split('\n');

for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('sub_assemblies') && (lines[i].includes('push') || lines[i].includes('...'))) {
    console.log(`Line ${i+1}: ${lines[i].trim()}`);
  }
}
