const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/ClientQuotations.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<div style="display: flex; justify-content: space-between; margin-bottom: 5px;">\s*<span>Current BOM Cost:<\/span>\s*<span style="font-weight: 600; color: #64748b;">\$\{formatCurrency\(targetItem\.bom_cost \|\| targetItem\.latest_bom_cost\)\}<\/span>\s*<\/div>\s*<div style="display: flex; justify-content: space-between;">\s*<span>New BOM Cost:<\/span>\s*<span style="font-weight: 700; color: #e11d48;">\$\{formatCurrency\(targetItem\.pending_bom_cost\)\}<\/span>\s*<\/div>/g;

const replacement = `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Current BOM Cost:</span>
              <span style="font-weight: 600; color: #64748b;">\${formatCurrency(parseFloat(targetItem.previous_bom_cost || targetItem.old_bom_cost || targetItem.original_bom_cost || 0))}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>New BOM Cost:</span>
              <span style="font-weight: 700; color: #e11d48;">\${formatCurrency(parseFloat(targetItem.pending_bom_cost || targetItem.latest_bom_cost || targetItem.bom_cost || 0))}</span>
            </div>`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Replaced popup cost logic successfully.');
} else {
  console.log('Regex missed');
  // Attempt to inject it manually
  const altRegex = /<span>Current BOM Cost:<\/span>[\s\S]*?<\/div>/;
  if(content.match(altRegex)){
     console.log('Found alternative match, but aborting to avoid messing up HTML.');
  }
}

