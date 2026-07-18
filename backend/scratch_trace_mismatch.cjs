const fs = require('fs');
const content = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/ProductionPlan.jsx', 'utf8');
const lines = content.split('\n');

let braceCount = 0;
let parenCount = 0;
let bracketCount = 0;

// Scan lines 2790 to 3351 (0-indexed lines 2789 to 3350)
for (let i = 2789; i <= 3350; i++) {
    const line = lines[i];
    if (!line) continue;
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
    }
    if (braceCount < 0 || parenCount < 0 || bracketCount < 0) {
        console.log(`Mismatch on line ${i + 1}: brace=${braceCount}, paren=${parenCount}, bracket=${bracketCount}`);
    }
}

console.log(`End stats: brace=${braceCount}, paren=${parenCount}, bracket=${bracketCount}`);
