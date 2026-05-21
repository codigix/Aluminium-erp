const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix mappedItems filter
content = content.replace(
  /const g = \(item\.item_group \|\| ''\)\.toUpperCase\(\);\s*const t = \(item\.item_type \|\| ''\)\.trim\(\)\.toUpperCase\(\);\s*const isFG = \(g\.includes\('FG'\) \|\| t\.includes\('FG'\) \|\| g\.includes\('FINISHED'\)\) && !g\.includes\('SA'\) && !g\.includes\('SUB'\);\s*if \(!isFG\) \{/g,
  `const g = (item.item_group || '').toUpperCase();
          const isPart = g.includes('PART');
          
          if (isPart) {`
);

// 2. Fix drwIsSA filter
content = content.replace(
  /const itemG = \(item\.item_group \|\| ''\)\.toUpperCase\(\);\s*const itemIsSA = \(itemG\.includes\('SA'\) \|\| itemG\.includes\('SUB'\) \|\| itemG\.includes\('ASSEMBLY'\)\) && !itemG\.includes\('FG'\);\s*const matchedDrawing = drawings\.find\(d => \{\s*const drwG = \(d\.item_group \|\| ''\)\.toUpperCase\(\);\s*const drwIsSA = \(drwG\.includes\('SA'\) \|\| drwG\.includes\('SUB'\) \|\| drwG\.includes\('ASSEMBLY'\)\) && !drwG\.includes\('FG'\);/g,
  `const itemG = (item.item_group || '').toUpperCase();
        const itemIsPart = itemG.includes('PART');
        
        const matchedDrawing = drawings.find(d => {
          const drwG = (d.item_group || '').toUpperCase();
          const drwIsPart = drwG.includes('PART');`
);

content = content.replace(
  /\/\/ Group must match \(SA vs FG\)\s*if \(itemIsSA === drwIsSA\) \{/g,
  `// Group must match (PART vs ASSEMBLY)
            if (itemIsPart === drwIsPart) {`
);

// 3. Fix badge variables (view mode & manual/revise mode)
content = content.replace(
  /const isPart = g\.includes\('PART'\);\s*const isSA = isPart;\s*const isAssembly = !isSA;/g,
  `const isPart = g.includes('PART');`
);
content = content.replace(
  /const isSA = isPart;\s*const isAssembly = !isSA;/g,
  ``
);
content = content.replace(
  /isSA \s*\? 'bg-emerald-100/g,
  `isPart \n                                                ? 'bg-emerald-100`
);
content = content.replace(
  /\{isSA \? \(g\.includes\('ASSEMBLY'\) && !g\.includes\('SUB'\) \? 'ASSY' : 'SA'\) : item\.item_group\}/g,
  `{isPart ? 'PART' : 'ASSEMBLY'}`
);

// 4. Fix sub-assembly label
content = content.replace(
  /<span className="px-1\.5 py-0\.5 rounded text-xs border bg-emerald-100 text-emerald-700 border-emerald-200">\s*PART\s*<\/span>/g,
  `<span className="px-1.5 py-0.5 rounded text-xs border bg-emerald-100 text-emerald-700 border-emerald-200">\n                                      {sa.item_group || 'PART'}\n                                    </span>`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixes applied successfully!');
