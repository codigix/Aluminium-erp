const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/ClientQuotations.jsx', 'utf8').split('\n');
let start = -1;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('handleCreateQuotation')) {
    start = i;
  }
  if (start !== -1 && i < start + 30) {
    console.log((i+1) + ": " + lines[i]);
  }
}
