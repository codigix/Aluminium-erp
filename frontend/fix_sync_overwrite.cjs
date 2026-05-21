const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Inside syncDrawings, change the overwrite logic:
const overwriteRegex = /const costChanged = drwRate > 0 && Math\.abs\(currentBOMCost - drwRate\) > 0\.01;\s*if \(costChanged && \(shouldSync \|\| saChanged\) && \!item\.has_pending_bom_applied\) \{/g;
const newOverwrite = `const costChanged = drwRate > 0 && Math.abs(currentBOMCost - drwRate) > 0.01;
          
          // NEVER downgrade an Assembly's BOM cost if the Quotation data already has a higher, finalized cost from the BOM module.
          // Master drawings might have stale base costs if they haven't been dynamically synced with full BOM materials/operations.
          const isDowngradeForAssembly = g.includes('ASSEMBLY') && currentBOMCost > drwRate;

          if (costChanged && (shouldSync || saChanged) && !item.has_pending_bom_applied && !isDowngradeForAssembly) {`;

if (content.match(overwriteRegex)) {
  content = content.replace(overwriteRegex, newOverwrite);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed syncDrawings overwrite logic!');
} else {
  console.log('Failed to find syncDrawings overwrite logic');
}
