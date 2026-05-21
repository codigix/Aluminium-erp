const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/ClientQuotations.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

let start = -1;
let end = -1;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('const handleApplyPendingBOM =')) {
    start = i;
  }
  if (start !== -1 && lines[i].includes('navigate(')) {
    end = i + 20;
    break;
  }
}

for(let i=start; i<=end; i++) {
  console.log(`Line ${i+1}: ${lines[i].trim()}`);
}
