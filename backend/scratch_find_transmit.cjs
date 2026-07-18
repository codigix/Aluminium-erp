const fs = require('fs');
const content = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/ProductionPlan.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('transmit') || line.includes('Transmit') || line.includes('Material Request') && line.includes('fetch')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
