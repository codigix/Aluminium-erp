const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// The block we want to inject:
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

// Check if the "if (!isHistorical)" block exists
const regexHistorical = /\/\/\s*For NEW revisions, we might want to recalculate[\s\S]*?bomCost = calculatedTotal;\s*\}\s*\}/g;

// Check if the "NEVER overwrite finalized BOM" block exists
const regexNeverOverwrite = /\/\/\s*NEVER overwrite finalized BOM from backend\.[\s\S]*?bomCost = drwRate;/g;

if (content.match(regexHistorical)) {
  content = content.replace(regexHistorical, newLogic);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Replaced historical block successfully!');
} else if (content.match(regexNeverOverwrite)) {
  content = content.replace(regexNeverOverwrite, newLogic);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Replaced never overwrite block successfully!');
} else {
  console.log('Could not find either block');
}
