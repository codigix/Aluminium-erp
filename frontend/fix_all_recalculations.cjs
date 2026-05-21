const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. syncDrawings recalculation
const syncRegex = /\/\/ Recalculate based on sub-assemblies if they exist - helps catch stale ASSEMBLY costs\s*if \(matchedDrawing\.sub_assemblies && matchedDrawing\.sub_assemblies\.length > 0\) \{[\s\S]*?if \(saSum > drwRate\) \{\s*drwRate = saSum;\s*\}\s*\}/g;

const newSync = `if (matchedDrawing.sub_assemblies && matchedDrawing.sub_assemblies.length > 0) {
              // NEVER recalculate FG/Assembly from child parts
              // Backend BOM already contains final calculated cost
              drwRate = parseFloat(
                matchedDrawing.bom_cost ||
                matchedDrawing.rate ||
                matchedDrawing.quotedPrice ||
                0
              );
            }`;

content = content.replace(syncRegex, newSync);


// 2. loadVersionData recalculation
const loadRegex = /\/\/ For NEW revisions, we might want to recalculate based on updated sub-assemblies, materials and operations\s*\/\/ For HISTORICAL versions \(Sent, Approved, etc\.\), we MUST NOT recalculate - we trust the snapshot exactly\s*if \(\!isHistorical\) \{[\s\S]*?bomCost = calculatedTotal;\s*\}\s*\}/g;

const newLoad = `// NEVER overwrite finalized BOM from backend.
          // Backend BOM already includes:
          // - materials
          // - operations
          // - assemblies
          // - process costing
          
          drwRate = parseFloat(
            item.latest_bom_cost ||
            item.bom_cost ||
            drwRate ||
            0
          );
          
          bomCost = drwRate;`;

content = content.replace(loadRegex, newLoad);


// 3. mappedItems recalculation
const mappedRegex = /\/\/ Recalculate based on sub-assemblies if they exist - helps catch stale ASSEMBLY costs\s*if \(item\.sub_assemblies && item\.sub_assemblies\.length > 0\) \{[\s\S]*?bomCost = saSum;\s*drwRate = saSum;\s*\}\s*\}/g;

const newMapped = `if (item.sub_assemblies && item.sub_assemblies.length > 0) {
            // NEVER recalculate FG/Assembly from child parts
            drwRate = parseFloat(item.bom_cost || drwRate || 0);
            bomCost = drwRate;
          }`;

content = content.replace(mappedRegex, newMapped);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully removed all frontend recalculations!');
