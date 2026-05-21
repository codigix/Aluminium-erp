const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/backend/src/controllers/quotationRequestController.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /rate:\s*parseFloat\(sn\.received_amount\)\s*\|\|\s*parseFloat\(sn\.bom_cost\)\s*\|\|\s*0/g;
const replacement = 'rate: parseFloat(sn.bom_cost) || 0';

if (content.match(regex)) {
  const matchCount = content.match(regex).length;
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Replaced ${matchCount} occurrences in quotationRequestController.js successfully!`);
} else {
  console.log('Could not find the target string in quotationRequestController.js');
}
