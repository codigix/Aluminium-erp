const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix sub_assemblies assignment in SearchableSelect
const oldSubAssemblies = `sub_assemblies: (drw?.sub_assemblies && drw.sub_assemblies.length > 0) ? drw.sub_assemblies : (it.sub_assemblies || [])`;
const newSubAssemblies = `sub_assemblies: g.includes('ASSEMBLY')
                                                    ? ((drw?.sub_assemblies && drw.sub_assemblies.length > 0)
                                                        ? drw.sub_assemblies.filter(sa => (sa.item_group || '').toUpperCase().includes('PART'))
                                                        : (it.sub_assemblies || []).filter(sa => (sa.item_group || '').toUpperCase().includes('PART')))
                                                    : []`;

content = content.replace(oldSubAssemblies, newSubAssemblies);

// 2. Fix calculateSummary (again, just in case)
content = content.replace(
  /const billableItems = items\.filter\(item => \{\s*return \(parseFloat\(item\.rate\) \|\| 0\) > 0 \|\| \(item\.item_group \|\| ''\)\.toUpperCase\(\)\.includes\('FG'\);\s*\}\);/g,
  `const billableItems = items.filter(item => {
      const g = (item.item_group || '').toUpperCase();
      return (
        (parseFloat(item.rate) || 0) > 0 ||
        g.includes('ASSEMBLY') ||
        g.includes('PART')
      );
    });`
);

// 3. Fix <span>PART</span> (again, just in case there are other occurrences)
content = content.replace(
  /<span className="[^"]*bg-emerald-50 text-emerald-600[^"]*">\s*PART\s*<\/span>/g,
  `<span className="px-1 py-0.5 rounded-[3px] text-[8px] border bg-emerald-50 text-emerald-600 border-emerald-100/50">\n                                        {(sa.item_group || 'PART').toUpperCase()}\n                                      </span>`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixes applied successfully!');
