const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/src/pages/BOMFormPage.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('itemGroup') && (line.includes('select') || line.includes('option') || line.includes('onChange') || line.includes('value'))) {
        console.log(`${index + 1}: ${line}`);
    }
});
