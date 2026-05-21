const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const savedSubAssemblies = \(\(\(override\?\.sub_assemblies \|\| item\.sub_assemblies\) \|\| \[\]\)\.map\(sa => \{[\s\S]*?pending_bom_cost: sa\.pending_bom_cost \? parseFloat\(sa\.pending_bom_cost\) : undefined\s*\};\s*\}\);/g;

const replacement = `const savedSubAssemblies = ((override?.sub_assemblies || item.sub_assemblies) || []).map(sa => {
            const actualPartCost = parseFloat(sa.part_bom_cost || sa.component_cost || sa.bom_cost || sa.rate || 0);
            return {
              ...sa,
              bom_cost: actualPartCost,
              rate: actualPartCost
            };
          });`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully replaced savedSubAssemblies logic in loadVersionData!');
} else {
  console.log('Could not find the target regex block');
}
