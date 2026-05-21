const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const startIndex = 103; // line 104 is allSourceItems
const endIndex = 151; // line 152 is }

const newCode = `      const allSourceItems = initialData.items || [];
      const nestedPartCodes = new Set();

      (allSourceItems || []).forEach(item => {
        (item.sub_assemblies || []).forEach(sa => {
          nestedPartCodes.add(
            String(sa.component_code || sa.item_code || '')
              .trim()
              .toUpperCase()
          );
        });
      });

      const mappedItems = allSourceItems
        .filter(item => {
          const group = (item.item_group || '').toUpperCase();
          const code = String(item.item_code || '').trim().toUpperCase();
          const isPart = group.includes('PART');

          // Remove PART rows already nested inside assembly
          if (isPart && nestedPartCodes.has(code)) {
            return false;
          }

          return true;
        })`;

lines.splice(startIndex, endIndex - startIndex + 1, newCode);

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log("Fixes applied successfully to nested part filtering.");
