const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/src/App.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('bom-form')) {
        console.log(`${index + 1}: ${line}`);
    }
});
