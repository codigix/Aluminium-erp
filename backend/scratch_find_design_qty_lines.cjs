const fs = require('fs');

function findLines(filePath) {
    console.log(`\n=== Matches in ${filePath} ===`);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (line.toLowerCase().includes('design_qty') || line.toLowerCase().includes('design qty')) {
            console.log(`Line ${index + 1}: ${line.trim()}`);
        }
    });
}

findLines('e:/codigix-project/Aluminium-erp/frontend/src/pages/ProductionPlan.jsx');
findLines('e:/codigix-project/Aluminium-erp/frontend/src/pages/POMaterialRequest.jsx');
