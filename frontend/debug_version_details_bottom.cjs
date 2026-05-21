const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/backend/src/controllers/quotationRequestController.js', 'utf8').split('\n');

for (let i = 910; i < 950; i++) {
  if (lines[i]) {
    console.log((i+1) + ": " + lines[i]);
  }
}
