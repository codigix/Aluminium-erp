const fs = require('fs');
const content = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/ItemsMaster.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('calculate') || line.includes('weight') || line.includes('Weight')) {
        if (line.includes('function') || line.includes('const') || line.includes('=>')) {
            console.log(`Line ${index + 1}: ${line.trim()}`);
        }
    }
});
