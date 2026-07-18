const fs = require('fs');
const content = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/ItemsMaster.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('Math.PI') || line.includes('density') || line.includes('1000000')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
