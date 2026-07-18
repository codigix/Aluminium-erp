const fs = require('fs');
const content = fs.readFileSync('e:/codigix-project/Aluminium-erp/backend/src/services/productionPlanService.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('getMaterialRequestItems')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
