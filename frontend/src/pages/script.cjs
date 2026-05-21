const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Remove the `if (isAssembly) return null;` lines which hide the badge
content = content.replace(/if \(isAssembly\) return null;/g, "");

fs.writeFileSync(file, content, 'utf8');
console.log('Badge logic fixed.');
