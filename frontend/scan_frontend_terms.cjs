const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const searchTerms = ['isFG', 'isSA', 'FG', 'FINISHED', 'SUB', 'mappedItems', 'nestedIdentities', 'PART'];
lines.forEach((line, i) => {
  if (searchTerms.some(term => line.includes(term))) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});
