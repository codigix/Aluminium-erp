const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/backend/src/services/drawingService.js', 'utf8').split('\n');

for(let i=70; i<100; i++) {
  if (lines[i]) console.log((i+1) + ": " + lines[i]);
}
