const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace the end of syncDrawings `hasChanges` logic
// Currently it might be:
// const hasChanges = JSON.stringify(updatedItems) !== JSON.stringify(items);
// if (!hasChanges) return;
// setItems(updatedItems);
// Let's just replace from `const hasChanges` or `const currentJson` up to the `setItems` with the exact snippet.
const endRegex = /(const hasChanges = [^;]+;\s*if \(\!hasChanges\) return;\s*setItems\(updatedItems\);)/g;
const newEnd = `const currentJson = JSON.stringify(items);
      const updatedJson = JSON.stringify(updatedItems);

      if (currentJson === updatedJson) {
        return;
      }

      setItems(updatedItems);`;
if (content.match(endRegex)) {
  content = content.replace(endRegex, newEnd);
  console.log('Fixed hasChanges block');
} else {
  console.log('Could not find existing hasChanges block to replace');
}

// 2. saChanged logic
const saRegex = /const saChanged = matchedDrawing\.sub_assemblies &&[\s\S]*?JSON\.stringify\(matchedDrawing\.sub_assemblies\);/g;
if (content.match(saRegex)) {
  content = content.replace(saRegex, 'const saChanged = false;');
  console.log('Fixed saChanged block');
} else {
  // Check if it's on a single line
  const saRegex2 = /const saChanged = matchedDrawing\.sub_assemblies && JSON\.stringify\(item\.sub_assemblies\) !== JSON\.stringify\(matchedDrawing\.sub_assemblies\);/g;
  if (content.match(saRegex2)) {
    content = content.replace(saRegex2, 'const saChanged = false;');
    console.log('Fixed saChanged block (single line)');
  } else {
    console.log('Could not find saChanged block');
  }
}

// 3. Remove any remaining recalculation block if it somehow exists
const reduceRegex = /if \(matchedDrawing\.sub_assemblies && matchedDrawing\.sub_assemblies\.length > 0\) \{[\s\S]*?if \(saSum > drwRate\) \{\s*drwRate = saSum;\s*\}\s*\}/g;
if (content.match(reduceRegex)) {
  content = content.replace(reduceRegex, '');
  console.log('Removed saSum reduce block');
} else {
  console.log('saSum reduce block already removed');
}

fs.writeFileSync(file, content, 'utf8');
console.log('Final fixes applied!');
