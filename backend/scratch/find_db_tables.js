const fs = require('fs');
const content = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/POMaterialRequest.jsx', 'utf8');

const lines = content.split('\n');
console.log('--- Stock and dots in POMaterialRequest.jsx ---');
lines.forEach((line, idx) => {
    if (line.includes('current_stock') || line.includes('availableStock') || line.includes('currentStock')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
