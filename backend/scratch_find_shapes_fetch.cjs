const fs = require('fs');
const content = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/ItemsMaster.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('shapes') || line.includes('shape') || line.includes('shape_id')) {
        if (line.includes('fetch') || line.includes('setShapes')) {
            console.log(`Line ${index + 1}: ${line.trim()}`);
        }
    }
});
