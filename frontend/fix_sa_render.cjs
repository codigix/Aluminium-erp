const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace formatCurrency(sa.bom_cost) in the JSX table
const jsxCostRegex = /<td className="p-2 border-b border-slate-100 text-\[11px\] text-indigo-600\s*bg-indigo-50\/30">\s*\{formatCurrency\(sa\.bom_cost\)\}\s*<\/td>/g;
const jsxCostReplacement = `<td className="p-2 border-b border-slate-100 text-[11px] text-indigo-600  bg-indigo-50/30">
                                {formatCurrency(sa.component_bom_cost || sa.child_bom_cost || sa.rate || 0)}
                              </td>`;

if (content.match(jsxCostRegex)) {
  content = content.replace(jsxCostRegex, jsxCostReplacement);
  console.log('Fixed JSX sa.bom_cost rendering');
} else {
  // Try alternative regex
  const altRegex = /\{formatCurrency\(sa\.bom_cost\)\}/g;
  if(content.match(altRegex)){
     console.log('Found formatCurrency(sa.bom_cost) but not the full td block. Doing generic replace.');
     // Wait, let's just replace the exact format string since it's only for sub-assemblies inside uniqueSubAssemblies
     // Actually I will do a precise replace inside uniqueSubAssemblies.forEach
  }
}

// 2. Fix sync logic for sub_assemblies
// In the useEffect where matchedDrawing.sub_assemblies is processed.
const syncRegex = /newItem\.sub_assemblies\s*=\s*matchedDrawing\.sub_assemblies\.map\(sa\s*=>\s*\({\s*\.\.\.sa,\s*bom_cost:\s*parseFloat\(sa\.bom_cost\s*\|\|\s*sa\.rate\s*\|\|\s*0\),\s*rate:\s*parseFloat\(sa\.rate\s*\|\|\s*sa\.bom_cost\s*\|\|\s*0\)\s*}\)\);/g;
const syncReplacement = `newItem.sub_assemblies = item.sub_assemblies?.length > 0 ? item.sub_assemblies : matchedDrawing.sub_assemblies;`;

if (content.match(syncRegex)) {
  content = content.replace(syncRegex, syncReplacement);
  console.log('Fixed sync logic for sub_assemblies array');
} else {
  console.log('Could not find sync block matching exactly.');
}

// 3. Just to be absolutely sure, I will do a broad search/replace for the JSX formatCurrency
let lines = content.split('\n');
let insideSaLoop = false;
for(let i=0; i<lines.length; i++){
   if(lines[i].includes('uniqueSubAssemblies.forEach')) insideSaLoop = true;
   if(insideSaLoop && lines[i].includes('formatCurrency(sa.bom_cost)')){
      lines[i] = lines[i].replace('formatCurrency(sa.bom_cost)', 'formatCurrency(sa.component_bom_cost || sa.child_bom_cost || sa.rate || 0)');
      console.log('Fixed JSX render manually.');
   }
   if(insideSaLoop && lines[i].includes('return rows;')) insideSaLoop = false;
}
content = lines.join('\n');

// Also replace any remaining matchedDrawing.sub_assemblies map logic if regex missed
for(let i=0; i<lines.length; i++){
   if(lines[i].includes('newItem.sub_assemblies = matchedDrawing.sub_assemblies.map')){
      console.log('Found sync block on line ' + (i+1));
      lines[i] = 'newItem.sub_assemblies = item.sub_assemblies?.length > 0 ? item.sub_assemblies : matchedDrawing.sub_assemblies;';
      let j = i+1;
      while(!lines[j].includes('changed = true;')){
         lines[j] = ''; // clear out the rest of the map
         j++;
      }
      content = lines.join('\n');
   }
}

fs.writeFileSync(file, content, 'utf8');
console.log('Done.');
