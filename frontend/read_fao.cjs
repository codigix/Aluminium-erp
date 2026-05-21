const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/ClientQuotations.jsx', 'utf8').split('\n');
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('fetchApprovedOrders = async')) {
    for(let j=i; j<i+30; j++) console.log((j+1) + ": " + lines[j]);
    break;
  }
}
