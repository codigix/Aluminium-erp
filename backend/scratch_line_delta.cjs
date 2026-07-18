const fs = require('fs');
const content = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/ProductionPlan.jsx', 'utf8');
const lines = content.split('\n');

for (let i = 2780; i <= 3395; i++) {
    const line = lines[i];
    let braceDiff = 0;
    let parenDiff = 0;
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') braceDiff++;
        else if (line[j] === '}') braceDiff--;
        else if (line[j] === '(') parenDiff++;
        else if (line[j] === ')') parenDiff--;
    }
    console.log(`Line ${i + 1}: braceDiff=${braceDiff}, parenDiff=${parenDiff} | ${line.trim()}`);
}
