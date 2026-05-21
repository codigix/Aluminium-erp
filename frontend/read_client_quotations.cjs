const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/ClientQuotations.jsx', 'utf8').split('\n');
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('response.data')) {
    for(let j=i-2; j<i+10; j++) console.log((j+1) + ": " + lines[j]);
    break;
  }
}
