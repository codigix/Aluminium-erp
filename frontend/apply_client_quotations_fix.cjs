const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/ClientQuotations.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `const drawings = response.data || [];`;
const newBlock = `const drawings = response.data || [];

      const normalizedDrawings = drawings.filter(item => {
        const g = (item.item_group || '').toUpperCase();

        // Remove PART rows already nested under assembly
        if (g.includes('PART')) {
          const belongsToAssembly = drawings.some(parent =>
            (parent.sub_assemblies || []).some(sa =>
              (sa.component_code || '').trim().toUpperCase() ===
              (item.item_code || '').trim().toUpperCase()
            )
          );

          if (belongsToAssembly) {
            return false;
          }
        }

        return true;
      });`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, newBlock);
} else {
  console.log("Could not find 'const drawings = response.data || [];'");
}

const targetStr2 = `setApprovedDrawings(drawings);`;
const newBlock2 = `setApprovedDrawings(normalizedDrawings);`;

if (content.includes(targetStr2)) {
  content = content.replace(targetStr2, newBlock2);
} else {
  console.log("Could not find 'setApprovedDrawings(drawings);'");
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fix applied to ClientQuotations.jsx successfully!');
