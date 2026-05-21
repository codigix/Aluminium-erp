const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix 1: Sub-assemblies mapping
const regexSA = /const savedSubAssemblies = \(\(\(override\?\.sub_assemblies \|\| item\.sub_assemblies\) \|\| \[\]\)\.map\(sa => \{[\s\S]*?pending_bom_cost: sa\.pending_bom_cost \? parseFloat\(sa\.pending_bom_cost\) : undefined\s*\};\s*\}\);/g;
const replacementSA = `const savedSubAssemblies = ((override?.sub_assemblies || item.sub_assemblies) || []).map(sa => {
            const actualPartCost = parseFloat(sa.part_bom_cost || sa.component_cost || sa.bom_cost || sa.rate || 0);
            return {
              ...sa,
              bom_cost: actualPartCost,
              rate: actualPartCost
            };
          });`;

let changed1 = false;
if (content.match(regexSA)) {
  content = content.replace(regexSA, replacementSA);
  changed1 = true;
}

// Fix 2: STRICT SNAPSHOT MODE instead of !isHistorical block or Never overwrite finalized BOM block
const newLogic = `// STRICT SNAPSHOT MODE
          // Never recalculate saved quotation/revision costs from frontend.
          // Always trust backend BOM snapshot values.

          if (forceNextVersion && item.pending_bom_cost > 0) {
            bomCost = parseFloat(item.pending_bom_cost);
            drwRate = parseFloat(item.pending_bom_cost);
          } else {
            drwRate = parseFloat(item.latest_bom_cost || item.bom_cost || drwRate || 0);
            bomCost = drwRate;
          }`;

const regexHistorical = /\/\/\s*For NEW revisions, we might want to recalculate[\s\S]*?bomCost = calculatedTotal;\s*\}\s*\}/g;
const regexNeverOverwrite = /\/\/\s*NEVER overwrite finalized BOM from backend\.[\s\S]*?bomCost = drwRate;/g;

let changed2 = false;
if (content.match(regexHistorical)) {
  content = content.replace(regexHistorical, newLogic);
  changed2 = true;
} else if (content.match(regexNeverOverwrite)) {
  content = content.replace(regexNeverOverwrite, newLogic);
  changed2 = true;
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fix 1 (sub assemblies): ' + changed1);
console.log('Fix 2 (snapshot mode): ' + changed2);
