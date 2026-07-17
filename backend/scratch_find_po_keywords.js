const fs = require('fs');
const content = fs.readFileSync('e:/codigix-project/Aluminium-erp/backend/src/services/purchaseOrderService.js', 'utf8');
const lines = content.split('\n');

const keywords = ['pdf', 'generate', 'mustache', 'html', 'puppeteer', 'template', 'design_qty', 'req_qty'];

lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase();
    for (const kw of keywords) {
        if (lowerLine.includes(kw)) {
            console.log(`Line ${index + 1} [${kw}]: ${line.trim()}`);
            break;
        }
    }
});
