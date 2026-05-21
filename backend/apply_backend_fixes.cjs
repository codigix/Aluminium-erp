const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/backend/src/controllers/quotationRequestController.js';
let content = fs.readFileSync(file, 'utf8');

// 1. CHANGE DEFAULT ITEM GROUP
content = content.replace(
  /COALESCE\(qr\.item_group, soi\.item_group, 'FG'\) as item_group/g,
  "COALESCE(qr.item_group, soi.item_group, 'ASSEMBLY') as item_group"
);

// 2. REMOVE OLD SA/FG FILTER & 3. FIX COMPONENT FILTER (in getQuotationRequests - line 86)
content = content.replace(
  /const isDrawingOrSA = g\.includes\('SA'\) \|\| g\.includes\('SUB'\) \|\| g\.includes\('ASSEMBLY'\) \|\| g\.includes\('PART'\)(?: \|\| \(row\.drawing_no && row\.drawing_no !== '[^']+'\))?;\s*const sub_assemblies = isDrawingOrSA \? components : components\.filter\(c => \{\s*const code = \(c\.item_code \|\| c\.component_code \|\| ''\)\.toUpperCase\(\);\s*const group = \(c\.item_group \|\| ''\)\.toUpperCase\(\);\s*const desc = \(c\.description \|\| ''\)\.toUpperCase\(\);\s*return code\.startsWith\('SA-'\) \|\| code\.startsWith\('SFG-'\) \|\| code\.startsWith\('PART-'\) \|\|\s*group\.includes\('SA'\) \|\| group\.includes\('SUB'\) \|\| group\.includes\('ASSEMBLY'\) \|\|\s*desc\.includes\('ASSEMBLY'\) \|\| desc\.includes\('UNIT'\) \|\|\s*group\.includes\('PART'\)(?: \|\| \(c\.drawing_no && c\.drawing_no !== '[^']+'\))?;\s*\}\);/g,
  `const isAssembly = g.includes('ASSEMBLY');
          const isPart = g.includes('PART');
          const sub_assemblies = isAssembly ? components : components.filter(c => {
            const group = (c.item_group || '').toUpperCase();
            return (
              group.includes('PART') ||
              group.includes('ASSEMBLY')
            );
          });`
);

// Second occurrence (in getQuotationVersionDetails - line 262)
content = content.replace(
  /const isDrawingOrSA = g\.includes\('SA'\) \|\| g\.includes\('SUB'\) \|\| g\.includes\('ASSEMBLY'\) \|\| g\.includes\('PART'\)(?: \|\| \(row\.drawing_no && row\.drawing_no !== '[^']+'\))?;\s*itemData\.sub_assemblies = isDrawingOrSA \? components : components\.filter\(c => \{\s*const code = \(c\.item_code \|\| c\.component_code \|\| ''\)\.toUpperCase\(\);\s*const group = \(c\.item_group \|\| ''\)\.toUpperCase\(\);\s*return \(code\.startsWith\('SA-'\) \|\| group\.includes\('SA'\) \|\| group\.includes\('SUB'\) \|\| group\.includes\('ASSEMBLY'\)\) && !group\.includes\('FG'\);\s*\}\);/g,
  `const isAssembly = g.includes('ASSEMBLY');
          const isPart = g.includes('PART');
          itemData.sub_assemblies = isAssembly ? components : components.filter(c => {
            const group = (c.item_group || '').toUpperCase();
            return (
              group.includes('PART') ||
              group.includes('ASSEMBLY')
            );
          });`
);

// 4. FIX SUB COMPONENT SAVE (in createQuotationRequest / updateQuotationRequest - line 550)
content = content.replace(
  /sa\.item_group \|\| 'SUB ASSEMBLY'/g,
  "sa.item_group || 'PART'"
);

// Update comments just to be clean
content = content.replace(/FG or SA/g, "ASSEMBLY or PART");
content = content.replace(/active FG quotation/g, "active ASSEMBLY quotation");

fs.writeFileSync(file, content, 'utf8');
console.log('Fixes applied successfully!');
