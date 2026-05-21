const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
const content = fs.readFileSync(file, 'utf8');

let divCount = 0;
const lines = content.split('\n');
for (let i = 1200; i < 1330; i++) {
  const line = lines[i];
  const opens = (line.match(/<div/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  divCount += opens - closes;
  console.log(`${i + 1} (${divCount}): ${line.trim()}`);
}
