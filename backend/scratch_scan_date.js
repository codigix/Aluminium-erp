const fs = require('fs');

const content = fs.readFileSync('d:/projects/Aluminium-erp/backend/src/services/dashboardService.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('DATE(')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
