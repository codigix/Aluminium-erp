const fs = require('fs');
const path = require('path');

const pagesDir = 'e:\\codigix-project\\Aluminium-erp\\frontend\\src\\pages';
const files = fs.readdirSync(pagesDir);

for (const file of files) {
  if (file.endsWith('.jsx') || file.endsWith('.js')) {
    const filePath = path.join(pagesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('SearchableSelect')) {
      console.log(`\n=== File: ${file} ===`);
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('<SearchableSelect')) {
          console.log(`Line ${index + 1}:`);
          for (let i = 0; i < 6; i++) {
            if (lines[index + i]) {
              console.log(`  ${lines[index + i].trim()}`);
            }
          }
        }
      });
    }
  }
}
