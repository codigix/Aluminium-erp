const fs = require('fs');
const { parse } = require('@babel/parser');
const code = fs.readFileSync('e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx', 'utf8');
try {
  parse(code, { sourceType: 'module', plugins: ['jsx'] });
  console.log("No syntax errors found.");
} catch (e) {
  console.error("Syntax Error: " + e.message);
  console.error("Location: line " + e.loc.line + ", col " + e.loc.column);
}
