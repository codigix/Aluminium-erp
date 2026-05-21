const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace the sub_assemblies assignment block
// The user has either:
// if (matchedDrawing.sub_assemblies && (!hasSAs || (saChanged && !item.has_pending_bom_applied))) {
//   newItem.sub_assemblies = matchedDrawing.sub_assemblies;
// OR
// if (matchedDrawing.sub_assemblies && matchedDrawing.sub_assemblies.length > 0 && (!hasSAs || saChanged)) {
//   const g = (item.item_group || matchedDrawing.item_group || '').toUpperCase();
//   newItem.sub_assemblies = g.includes('ASSEMBLY') ? matchedDrawing.sub_assemblies.filter(...) : [];

const regexSA1 = /if\s*\(\s*matchedDrawing\.sub_assemblies\s*&&\s*\(\s*!hasSAs\s*\|\|\s*\(\s*saChanged\s*&&\s*!item\.has_pending_bom_applied\s*\)\s*\)\s*\)\s*\{[\s\S]*?changed\s*=\s*true;\s*\}/g;
const regexSA2 = /if\s*\(\s*matchedDrawing\.sub_assemblies\s*&&\s*matchedDrawing\.sub_assemblies\.length\s*>\s*0\s*&&\s*\(\s*!hasSAs\s*\|\|\s*saChanged\s*\)\s*\)\s*\{[\s\S]*?changed\s*=\s*true;\s*\}/g;

const replacementSA = `if (matchedDrawing.sub_assemblies && matchedDrawing.sub_assemblies.length > 0 && (!hasSAs || saChanged)) {
            newItem.sub_assemblies = matchedDrawing.sub_assemblies.map(sa => ({
              ...sa,
              bom_cost: parseFloat(sa.bom_cost || sa.rate || 0),
              rate: parseFloat(sa.rate || sa.bom_cost || 0)
            }));
            changed = true;
          }`;

if (content.match(regexSA1)) {
  content = content.replace(regexSA1, replacementSA);
  console.log("Fixed sa mapping block 1");
} else if (content.match(regexSA2)) {
  content = content.replace(regexSA2, replacementSA);
  console.log("Fixed sa mapping block 2");
} else {
  console.log("Could not find sa mapping block to replace");
}

// 2. Remove the dangerous saSum recalculation
// if (matchedDrawing.sub_assemblies && matchedDrawing.sub_assemblies.length > 0) {
//   const saSum = matchedDrawing.sub_assemblies.reduce(...)
//   ...
//   if (saSum > drwRate) { drwRate = saSum; }
// }

const regexSaSum = /\/\/\s*Recalculate based on sub-assemblies if they exist[\s\S]*?if\s*\(\s*matchedDrawing\.sub_assemblies\s*&&\s*matchedDrawing\.sub_assemblies\.length\s*>\s*0\s*\)\s*\{[\s\S]*?if\s*\(\s*saSum\s*>\s*drwRate\s*\)\s*\{\s*drwRate\s*=\s*saSum;\s*\}\s*\}/g;

const replacementSaSum = `const masterBomCost = parseFloat(
            matchedDrawing.bom_cost ||
            matchedDrawing.rate ||
            matchedDrawing.quotedPrice ||
            0
          );
          drwRate = masterBomCost;`;

if (content.match(regexSaSum)) {
  content = content.replace(regexSaSum, replacementSaSum);
  console.log("Fixed saSum recalculation block");
} else {
  console.log("Could not find saSum recalculation block. Trying alternative regex.");
  const altRegexSaSum = /if\s*\(\s*matchedDrawing\.sub_assemblies\s*&&\s*matchedDrawing\.sub_assemblies\.length\s*>\s*0\s*\)\s*\{\s*const\s*saSum\s*=\s*matchedDrawing\.sub_assemblies\.reduce[\s\S]*?if\s*\(\s*saSum\s*>\s*drwRate\s*\)\s*\{\s*drwRate\s*=\s*saSum;\s*\}\s*\}/g;
  if (content.match(altRegexSaSum)) {
    content = content.replace(altRegexSaSum, replacementSaSum);
    console.log("Fixed saSum recalculation block (alt)");
  }
}

fs.writeFileSync(file, content, 'utf8');
