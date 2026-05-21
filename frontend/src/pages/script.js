const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/ClientQuotations.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace isSA/isFG logic
content = content.replace(/const isSA = \(g\.includes\('SA'\).*?;\n\s*const isFG = !isSA;/gs, 
  "const isPart = g.includes('PART') || (typeof t !== 'undefined' && t.includes('PART'));\n          const isAssembly = !isPart;");

// There are other variants of isSA definition:
content = content.replace(/const isSA = \(g\.includes\('SA'\) \|\| g\.includes\('SUB'\) \|\| g\.includes\('ASSEMBLY'\)\) && !g\.includes\('FG'\);/g, 
  "const isPart = g.includes('PART');");
  
content = content.replace(/const isSA = g\.includes\('SA'\) \|\| g\.includes\('SUB'\) \|\| g\.includes\('ASSEMBLY'\);/g, 
  "const isPart = g.includes('PART');");

content = content.replace(/const isFG = !isSA;/g, "const isAssembly = !isPart;");

// Replace usage of isSA and isFG
content = content.replace(/\bisSA\b/g, 'isPart');
content = content.replace(/\bisFG\b/g, 'isAssembly');

// Replace isSAA, isSAB, isFGA, isFGB
content = content.replace(/const isSAA = \(gA\.includes\('SA'\).*?;\n\s*const isSAB = \(gB\.includes\('SA'\).*?;\n\s*const isFGA = \(gA\.includes\('FG'\).*?;\n\s*const isFGB = \(gB\.includes\('FG'\).*?;/gs,
  "const isPartA = gA.includes('PART');\n          const isPartB = gB.includes('PART');\n          const isAssemblyA = !isPartA;\n          const isAssemblyB = !isPartB;");

content = content.replace(/\bisSAA\b/g, 'isPartA');
content = content.replace(/\bisSAB\b/g, 'isPartB');
content = content.replace(/\bisFGA\b/g, 'isAssemblyA');
content = content.replace(/\bisFGB\b/g, 'isAssemblyB');

// Replace text rendering
content = content.replace(/const displayGroup = isPart \? \(g\.includes\('ASSEMBLY'\) && !g\.includes\('SUB'\) \? 'ASSY' : 'SA'\) : \(g\.includes\('FG'\) \|\| g\.includes\('FINISHED'\) \? 'FG' : g\);/g,
  "const displayGroup = isPart ? 'PART' : 'ASSEMBLY';");

content = content.replace(/item\.item_group_calc = isPart \? \(g\.includes\('ASSEMBLY'\) \|\| t\.includes\('ASSEMBLY'\) \? \(g\.includes\('SUB'\) \|\| t\.includes\('SUB'\) \? 'SUB ASSEMBLY' : 'ASSEMBLY'\) : 'SUB ASSEMBLY'\) : \(g \|\| 'PART'\);/g,
  "item.item_group_calc = isPart ? 'PART' : 'ASSEMBLY';");

content = content.replace(/\(g === 'FG' \|\| g === 'FINISHED GOODS' \|\| g === 'FINISHED_GOODS' \|\| g\.includes\('FG'\)\) && !isPart/g,
  "isAssembly");

content = content.replace(/parts\.push\(`\$\{fgCount\} FG`\)/g, "parts.push(`\\${fgCount} ASSY`)");
content = content.replace(/parts\.push\(`\$\{saCount\} SA`\)/g, "parts.push(`\\${saCount} PART`)");

fs.writeFileSync(file, content, 'utf8');
console.log('Replacements done.');
