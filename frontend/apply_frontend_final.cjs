const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix calculateSummary
const oldSummary = `const billableItems = items.filter(item => {
      return (parseFloat(item.rate) || 0) > 0 || (item.item_group || '').toUpperCase().includes('FG');
    });`;

const newSummary = `const billableItems = items.filter(item => {
      const g = (item.item_group || '').toUpperCase();
      const isAssembly = g.includes('ASSEMBLY');
      const isPart = g.includes('PART');
      return (
        (parseFloat(item.rate) || 0) > 0 ||
        isAssembly ||
        isPart
      );
    });`;

content = content.replace(oldSummary, newSummary);

// 2. Fix hardcoded PART
const oldPart = `<span className="px-1 py-0.5 rounded-[3px] text-[8px] border bg-emerald-50 text-emerald-600 border-emerald-100/50">
                                        PART
                                      </span>`;
                                      
const newPart = `<span className="px-1 py-0.5 rounded-[3px] text-[8px] border bg-emerald-50 text-emerald-600 border-emerald-100/50">
                                        {(sa.item_group || 'PART').toUpperCase()}
                                      </span>`;

content = content.replace(oldPart, newPart);

// 3. Fix comments with FG just to be completely clean
content = content.replace(/helps catch stale FG costs/g, 'helps catch stale ASSEMBLY costs');
content = content.replace(/stored FG cost/g, 'stored ASSEMBLY cost');
content = content.replace(/SA vs FG/g, 'PART vs ASSEMBLY');

fs.writeFileSync(file, content, 'utf8');
console.log("Fixes applied successfully to frontend.");
