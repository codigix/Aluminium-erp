const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/backend/src/controllers/quotationRequestController.js', 'utf8').split('\n');

console.log("--- getQuotationVersionDetails sub_assemblies ---");
let start = 0;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('getQuotationVersionDetails = async')) start = i;
  if (start > 0 && i > start && i < start + 100) {
    if (lines[i].includes('itemData.sub_assemblies')) {
      for(let j=i-5; j<i+10; j++) console.log((j+1) + ": " + lines[j]);
      break;
    }
  }
}
