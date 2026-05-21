const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/backend/src/services/salesOrderService.js';
let content = fs.readFileSync(file, 'utf8');

// Replace FG / SA logic in salesOrderService.js

// 1. In getApprovedDrawings, the main query filter:
// TRIM(UPPER(soi.item_group)) IN ('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'SA', 'SUB ASSEMBLY', 'SUB_ASSEMBLY', 'ASSEMBLY') 
content = content.replace(/TRIM\(UPPER\(soi\.item_group\)\) IN \('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'SA', 'SUB ASSEMBLY', 'SUB_ASSEMBLY', 'ASSEMBLY'\)/g, 
  "TRIM(UPPER(soi.item_group)) IN ('ASSEMBLY', 'PART')");

content = content.replace(/TRIM\(UPPER\(soi\.item_type\)\) IN \('FG', 'FINISHED GOODS', 'FINISHED_GOODS', 'SA', 'SUB ASSEMBLY', 'SUB_ASSEMBLY', 'ASSEMBLY'\)/g, 
  "TRIM(UPPER(soi.item_type)) IN ('ASSEMBLY', 'PART')");

// 2. Fetch sub-assemblies for each item if it's an FG
content = content.replace(/\/\/ Fetch sub-assemblies for each item if it's an FG/g, "// Fetch sub-assemblies for each item if it's an ASSEMBLY");

content = content.replace(/const isSA = g\.includes\('SA'\) \|\| g\.includes\('SUB'\) \|\| g\.includes\('ASSEMBLY'\) \|\| t\.includes\('SA'\) \|\| t\.includes\('SUB'\) \|\| t\.includes\('ASSEMBLY'\);/g,
  "const isPart = g.includes('PART') || t.includes('PART');");
  
content = content.replace(/const isDrawingOrSA = isSA \|\| g\.includes\('PART'\) \|\| t\.includes\('PART'\) \|\| \(item\.drawing_no && item\.drawing_no !== '—'\);/g,
  "const isDrawingOrPart = isPart || (item.drawing_no && item.drawing_no !== '—');");

content = content.replace(/if \(isDrawingOrSA\) \{/g, "if (isDrawingOrPart) {");

content = content.replace(/return \(code\.startsWith\('SA-'\) \|\| code\.startsWith\('SFG-'\) \|\|\s*group\.includes\('SA'\) \|\| group\.includes\('SUB'\) \|\| group\.includes\('ASSEMBLY'\) \|\|\s*desc\.includes\('ASSEMBLY'\) \|\| desc\.includes\('UNIT'\)\) &&\s*!group\.includes\('FG'\);/g,
  "return group.includes('PART') || code.startsWith('PART-') || desc.includes('PART');");


fs.writeFileSync(file, content, 'utf8');
console.log('Backend Replacements done.');
