const fs = require('fs');

// --- 1. QuotationFormPage.jsx Fixes ---
const feFile = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let feLines = fs.readFileSync(feFile, 'utf8').split('\n');

for (let i = 0; i < feLines.length; i++) {
  if (feLines[i].includes('if (hasChanges) {') && feLines[i+1].includes('setItems(updatedItems);')) {
    feLines[i+1] = feLines[i+1].replace('setItems(updatedItems);', 'setItems([...updatedItems]);');
    break;
  }
}
fs.writeFileSync(feFile, feLines.join('\n'), 'utf8');

// --- 2. drawingService.js Fix ---
const dsFile = 'e:/codigix-project/Aluminium-erp/backend/src/services/drawingService.js';
let dsLines = fs.readFileSync(dsFile, 'utf8').split('\n');

let startDs = -1;
let endDs = -1;
for (let i = 0; i < dsLines.length; i++) {
  if (dsLines[i].includes('const isDrawingOrSA =')) startDs = i;
  if (startDs !== -1 && dsLines[i].includes('});')) {
    endDs = i;
    break;
  }
}

if (startDs !== -1 && endDs !== -1) {
  const newDsCode = `        const isAssembly = g.includes('ASSEMBLY');
        const sub_assemblies = isAssembly
          ? components.filter(c => {
              const group = (c.item_group || '').toUpperCase();
              return group.includes('PART');
            })
          : [];`;
  dsLines.splice(startDs, endDs - startDs + 1, newDsCode);
  fs.writeFileSync(dsFile, dsLines.join('\n'), 'utf8');
} else {
  console.log('WARNING: Could not find drawingService.js block.');
}

console.log('Remaining fixes applied!');
