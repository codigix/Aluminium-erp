const fs = require('fs');
const feFile = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(feFile, 'utf8');

const oldLogic = `            const calculatedTotal = saSum + materialSum + operationSum;
            const hasNestedComponents = savedSubAssemblies.length > 0 || (item.materials && item.materials.length > 0) || (item.operations && item.operations.length > 0);
            
            if (hasNestedComponents && calculatedTotal > 0) {
              drwRate = calculatedTotal;
              bomCost = calculatedTotal;
            } else if (calculatedTotal > (drwRate || bomCost)) {
              drwRate = calculatedTotal;
              bomCost = calculatedTotal;
            }`;

const newLogic = `            const calculatedTotal = saSum + materialSum + operationSum;
            
            // Only overwrite if the calculated total of parts explicitly exceeds the stored BOM cost.
            // This prevents the parent assembly's API bom_cost from being accidentally reduced if some 
            // nested costs (like materials or operations) weren't fully loaded into the frontend snapshot.
            if (calculatedTotal > (drwRate || bomCost)) {
              drwRate = calculatedTotal;
              bomCost = calculatedTotal;
            }`;

if (content.includes('const hasNestedComponents = savedSubAssemblies.length > 0')) {
  content = content.replace(oldLogic, newLogic);
  fs.writeFileSync(feFile, content, 'utf8');
  console.log('Successfully fixed aggressive overwrite in loadVersionData!');
} else {
  console.log('Failed to find aggressive overwrite block');
}
