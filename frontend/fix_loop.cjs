const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace hasChanges and setItems block
const hasChangesRegex = /const hasChanges = updatedItems\.some\([\s\S]*?\);\s*if \(hasChanges\) \{\s*setItems\(\[\.\.\.updatedItems\]\);\s*\}/g;
const newHasChanges = `const hasChanges = JSON.stringify(updatedItems) !== JSON.stringify(items);

      if (!hasChanges) return;

      setItems(updatedItems);`;

if (content.match(hasChangesRegex)) {
  content = content.replace(hasChangesRegex, newHasChanges);
} else {
  console.log('WARNING: Could not find hasChanges block.');
}

// 2. Replace dependencies array
const depsRegex = /\],\s*\[\s*drawings,\s*isLocked,\s*items\.map\(i => `\$\{i\.id\}-\$\{i\.drawing_id\}-\$\{i\.drawing_no\}-\$\{i\.item_code\}`\)\.join\('\|'\),\s*mode,\s*version,\s*selectedVersionId\s*\]\);/g;
const newDeps = `], [
    drawings, 
    isLocked, 
    mode, 
    version, 
    selectedVersionId
  ]);`;

if (content.match(depsRegex)) {
  content = content.replace(depsRegex, newDeps);
} else {
  console.log('WARNING: Could not find dependencies array.');
}

// 3. Remove the drwRate assignment block that we put in last turn
const drwRateRegex = /if \(matchedDrawing\.sub_assemblies && matchedDrawing\.sub_assemblies\.length > 0\) \{\s*\/\/ NEVER recalculate FG\/Assembly from child parts\s*\/\/ Backend BOM already contains final calculated cost\s*drwRate = parseFloat\(\s*matchedDrawing\.bom_cost \|\|\s*matchedDrawing\.rate \|\|\s*matchedDrawing\.quotedPrice \|\|\s*0\s*\);\s*\}/g;

if (content.match(drwRateRegex)) {
  content = content.replace(drwRateRegex, '');
} else {
  console.log('WARNING: Could not find the sub_assemblies matchedDrawing block.');
}

fs.writeFileSync(file, content, 'utf8');
console.log('Infinite loop fixes applied successfully!');
