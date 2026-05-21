const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('items.map(i => `${i.id}-${i.drawing_id}-${i.drawing_no}-${i.item_code}`).join(\'|\')')) {
    start = i - 3;
    end = i + 4;
    break;
  }
}

if (start !== -1) {
  const newDeps = `  }, [
    drawings, 
    isLocked, 
    mode, 
    version, 
    selectedVersionId
  ]);`;
  lines.splice(start, end - start + 1, newDeps);
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log('Dependencies array replaced successfully.');
} else {
  console.log('Could not find dependencies array lines.');
}
