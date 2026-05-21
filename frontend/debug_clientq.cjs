const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/ClientQuotations.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('bom_cost =') || lines[i].includes('bom_cost:')) {
    console.log(`Line ${i+1}: ${lines[i].trim()}`);
  }
}
