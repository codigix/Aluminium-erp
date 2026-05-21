const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/backend/src/controllers/quotationRequestController.js';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const searchTerms = ['FG', 'SA', 'SUB', 'SUB ASSEMBLY', 'FINISHED'];
lines.forEach((line, i) => {
  if (searchTerms.some(term => line.includes(term))) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});
