const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/ClientQuotations.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetRegex = /const data = await response\.json\(\);\s*const grouped = \{\};/g;

const replacement = `const data = await response.json();

      const normalizedDrawings = data.filter(item => {
        const g = (item.item_group || '').toUpperCase();

        // Remove PART rows already nested under assembly
        if (g.includes('PART')) {
          const belongsToAssembly = data.some(parent =>
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
      });

      const grouped = {};`;

if (content.match(targetRegex)) {
  content = content.replace(targetRegex, replacement);
  // Also replace `data.forEach(order => {` with `normalizedDrawings.forEach(order => {`
  content = content.replace(/data\.forEach\(order => \{/g, 'normalizedDrawings.forEach(order => {');
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully injected normalizedDrawings filter into ClientQuotations.jsx!');
} else {
  console.log('Failed to find target regex in ClientQuotations.jsx');
}
