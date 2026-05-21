const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const regexCost = /\/\/\s*For NEW revisions or DRAFTS[\s\S]*?bomCost\s*=\s*drwRate;\s*\}/g;

const simpleCost = `// Use ONLY backend BOM cost snapshot
          let bomCost = parseFloat(item.bom_cost || 0);
          let drwRate = parseFloat(item.rate || bomCost || 0);

          // If override for next version (revisions) has values, use them
          if (forceNextVersion) {
            if (override?.bom_cost > 0) bomCost = parseFloat(override.bom_cost);
            if (override?.rate > 0) drwRate = parseFloat(override.rate);
            if (item.pending_bom_cost > 0) {
              bomCost = parseFloat(item.pending_bom_cost);
              drwRate = parseFloat(item.pending_bom_cost);
            }
          }`;

if (content.match(regexCost)) {
  content = content.replace(regexCost, simpleCost);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Replaced complex cost logic with simple backend-only cost logic.');
} else {
  console.log('Regex missed');
}

