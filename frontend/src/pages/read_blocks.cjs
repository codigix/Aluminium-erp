const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

console.log("--- mappedItems filter ---");
for (let i = 125; i < 160; i++) console.log(lines[i]);

console.log("\n--- drwIsSA filter ---");
for (let i = 210; i < 235; i++) console.log(lines[i]);

console.log("\n--- badge rendering 1 ---");
for (let i = 1215; i < 1235; i++) console.log(lines[i]);
