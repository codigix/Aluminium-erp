const fs = require('fs');
const content = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/ProductionPlan.jsx', 'utf8');
const lines = content.split('\n');

let braceCount = 0;
let parenCount = 0;
let bracketCount = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
    }
    
    if (i >= 3585) {
        console.log(`Line ${i + 1}: brace=${braceCount}, paren=${parenCount}, bracket=${bracketCount} | ${line.trim().substring(0, 45)}`);
    }
}
