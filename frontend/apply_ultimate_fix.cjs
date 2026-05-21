const fs = require('fs');

// --- 1. FRONTEND FIXES ---
const frontendFile = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let frontendContent = fs.readFileSync(frontendFile, 'utf8');

// Fix 1: sub_assemblies mapping inside mappedItems
const oldSubAssemblies = `sub_assemblies: item.sub_assemblies || []`;
const newSubAssemblies = `sub_assemblies: (() => {
            const g = (item.item_group || '').toUpperCase();
            if (!g.includes('ASSEMBLY')) {
              return [];
            }
            return (item.sub_assemblies || []).filter(sa =>
              (sa.item_group || '').toUpperCase().includes('PART')
            );
          })()`;
frontendContent = frontendContent.replace(oldSubAssemblies, newSubAssemblies);

// Fix 2: calculateSummary - try to find it and replace the entire function or block
const summaryBlockRegex = /const billableItems = items\.filter\(item => \{\s*return \(parseFloat\(item\.rate\) \|\| 0\) > 0 \|\| \(item\.item_group \|\| ''\)\.toUpperCase\(\)\.includes\('FG'\);\s*\}\);/g;
const newSummaryBlock = `const billableItems = items.filter(item => {
      const g = (item.item_group || '').toUpperCase();
      return (
        (parseFloat(item.rate) || 0) > 0 ||
        g.includes('ASSEMBLY') ||
        g.includes('PART')
      );
    });`;

if (frontendContent.match(summaryBlockRegex)) {
  frontendContent = frontendContent.replace(summaryBlockRegex, newSummaryBlock);
} else {
  // Try a looser match if my regex was too strict
  const looseSummaryRegex = /const billableItems[\s\S]*?includes\('FG'\)[\s\S]*?\n\s*\}\);/m;
  frontendContent = frontendContent.replace(looseSummaryRegex, newSummaryBlock);
}

fs.writeFileSync(frontendFile, frontendContent, 'utf8');


// --- 2. BACKEND FIXES ---
const backendFile = 'e:/codigix-project/Aluminium-erp/backend/src/controllers/quotationRequestController.js';
let backendContent = fs.readFileSync(backendFile, 'utf8');

// Fix 3: Backend component filtering
const oldBackendFilterRegex = /const sub_assemblies = isAssembly \? components : components\.filter\(c => \{[\s\S]*?\}\);/g;
const newBackendFilter = `const sub_assemblies = isAssembly
            ? components.filter(c => {
                const group = (c.item_group || '').toUpperCase();
                return group.includes('PART');
              })
            : [];`;

backendContent = backendContent.replace(oldBackendFilterRegex, newBackendFilter);

// For the second occurrence which sets itemData.sub_assemblies:
const oldBackendFilter2Regex = /itemData\.sub_assemblies = isAssembly \? components : components\.filter\(c => \{[\s\S]*?\}\);/g;
const newBackendFilter2 = `itemData.sub_assemblies = isAssembly
            ? components.filter(c => {
                const group = (c.item_group || '').toUpperCase();
                return group.includes('PART');
              })
            : [];`;

backendContent = backendContent.replace(oldBackendFilter2Regex, newBackendFilter2);

fs.writeFileSync(backendFile, backendContent, 'utf8');
console.log('Final precise fixes applied to both frontend and backend!');
