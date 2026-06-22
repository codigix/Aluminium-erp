const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/src/pages/BOMFormPage.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let openBraceCount = 0;
let insideUseEffect = false;
let startLine = 0;

lines.forEach((line, index) => {
    if (line.includes('useEffect(')) {
        insideUseEffect = true;
        startLine = index + 1;
        console.log(`\n--- useEffect starting at line ${startLine} ---`);
    }
    if (insideUseEffect) {
        console.log(`${index + 1}: ${line}`);
        // Count curly braces to find the end of useEffect
        const openMatches = line.match(/\{/g);
        const closeMatches = line.match(/\}/g);
        if (openMatches) openBraceCount += openMatches.length;
        if (closeMatches) openBraceCount -= closeMatches.length;
        
        if (openBraceCount === 0 && line.includes(']')) {
            insideUseEffect = false;
        }
    }
});
