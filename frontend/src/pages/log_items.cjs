const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Insert a log right before rendering to see items state
content = content.replace(
  /const summary = calculateSummary\(\);/g,
  "const summary = calculateSummary();\n  console.log('Quotation Items for UI:', items);"
);

fs.writeFileSync(file, content, 'utf8');
