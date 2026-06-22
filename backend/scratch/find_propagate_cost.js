const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/services/bomService.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('propagateCostToParents') || line.includes('recalculateBOMCost') || line.includes('updateItemCostAndPropagate')) {
        console.log(`${index + 1}: ${line}`);
    }
});
