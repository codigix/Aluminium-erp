const fs = require('fs');
const content = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/ProductionPlan.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('confirmTransmit') || line.includes('transmit') || line.includes('API') || line.includes('post') || line.includes('axios')) {
        if (line.includes('mr') || line.includes('Mr') || line.includes('MR') || line.includes('Request') || line.includes('request')) {
            console.log(`Line ${index + 1}: ${line.trim()}`);
        }
    }
});
