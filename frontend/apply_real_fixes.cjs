const fs = require('fs');

// --- 1. QuotationFormPage.jsx Fixes ---
const feFile = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let feContent = fs.readFileSync(feFile, 'utf8');

// Replace useEffect sync logic
const oldSyncRegex = /if \(matchedDrawing\.sub_assemblies && \(!hasSAs \|\| \(saChanged && !item\.has_pending_bom_applied\)\)\) \{\s*newItem\.sub_assemblies = matchedDrawing\.sub_assemblies;\s*changed = true;\s*\}/;
const newSync = `if (
            matchedDrawing.sub_assemblies &&
            matchedDrawing.sub_assemblies.length > 0 &&
            (!hasSAs || saChanged)
          ) {
            const g = (item.item_group || matchedDrawing.item_group || '').toUpperCase();

            newItem.sub_assemblies =
              g.includes('ASSEMBLY')
                ? matchedDrawing.sub_assemblies.filter(sa =>
                    (sa.item_group || '').toUpperCase().includes('PART')
                  )
                : [];

            changed = true;
          }`;
if (feContent.match(oldSyncRegex)) {
  feContent = feContent.replace(oldSyncRegex, newSync);
} else {
  console.log('WARNING: Could not find useEffect sync logic block to replace.');
}

// Replace setItems([...updatedItems])
const oldSetItems = `if (hasChanges) {
          setItems(updatedItems);
        }`;
const newSetItems = `if (hasChanges) {
          // Force React deep refresh
          setItems([...updatedItems]);
        }`;
if (feContent.includes(oldSetItems)) {
  feContent = feContent.replace(oldSetItems, newSetItems);
} else {
  console.log('WARNING: Could not find setItems(updatedItems) to replace.');
}

fs.writeFileSync(feFile, feContent, 'utf8');

// --- 2. drawingService.js Fix ---
const dsFile = 'e:/codigix-project/Aluminium-erp/backend/src/services/drawingService.js';
let dsContent = fs.readFileSync(dsFile, 'utf8');

const oldDsRegex = /const isDrawingOrSA = g\.includes\('SA'\)[\s\S]*?group\.includes\('PART'\) \|\| \(c\.drawing_no && c\.drawing_no !== '—'\)\);\s*\}\);/g;
const newDs = `const isAssembly = g.includes('ASSEMBLY');
        const sub_assemblies = isAssembly
          ? components.filter(c => {
              const group = (c.item_group || '').toUpperCase();
              return group.includes('PART');
            })
          : [];`;

if (dsContent.match(oldDsRegex)) {
  dsContent = dsContent.replace(oldDsRegex, newDs);
} else {
  console.log('WARNING: Could not find drawingService.js legacy mapping block.');
}

fs.writeFileSync(dsFile, dsContent, 'utf8');

console.log('All real fixes applied!');
