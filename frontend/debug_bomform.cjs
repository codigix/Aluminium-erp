const fs = require('fs');
const lines = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/BOMFormPage.jsx', 'utf8').split('\n');

for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('bom_cost:') || lines[i].includes('update') || lines[i].includes('map')) {
    if (lines[i].includes('assemblyBomCost') || lines[i].includes('latestBomMap')) {
      console.log((i+1) + ": " + lines[i]);
    }
  }
}

// Let's also search for 'bom_cost: ' to see if something looks like what the user described
let start = -1;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('const handleSaveBOM')) {
    start = i;
  }
}
if (start !== -1) {
  console.log("Found handleSaveBOM at line " + (start+1));
}
