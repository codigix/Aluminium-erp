const fs = require('fs');
const content = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/BOMFormPage.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('Add New Material') || line.includes('Material Selection')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
