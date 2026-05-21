const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const isSA = isPart;\n\s*const isFG = !isSA;/g, '');
content = content.replace(/const isSA = isPart;/g, '');
content = content.replace(/const isFG = !isSA;/g, '');
content = content.replace(/const isFG = !isPart;/g, '');

fs.writeFileSync(file, content, 'utf8');
