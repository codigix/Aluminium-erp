const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. sub_assemblies
content = content.replace(
  /sub_assemblies:\s*g\.includes\('ASSEMBLY'\)\s*\?\s*\(\(drw\?\.sub_assemblies && drw\.sub_assemblies\.length > 0\)\s*\?\s*drw\.sub_assemblies\.filter\(sa => \(sa\.item_group \|\| ''\)\.toUpperCase\(\)\.includes\('PART'\)\)\s*:\s*\(it\.sub_assemblies \|\| \[\]\)\.filter\(sa => \(sa\.item_group \|\| ''\)\.toUpperCase\(\)\.includes\('PART'\)\)\)\s*:\s*\[\]/g,
  `sub_assemblies: g.includes('ASSEMBLY')
                                                    ? ((drw?.sub_assemblies && drw.sub_assemblies.length > 0)
                                                        ? drw.sub_assemblies.filter(sa => (sa.item_group || '').toUpperCase().includes('PART'))
                                                        : (it.sub_assemblies || []).filter(sa => (sa.item_group || '').toUpperCase().includes('PART')))
                                                    : []`
);

// 2. calculateSummary
const sumBlockRegex = /const billableItems = items\.filter\(item => \{\s*const g = \(item\.item_group \|\| ''\)\.toUpperCase\(\);\s*const isAssembly = g\.includes\('ASSEMBLY'\);\s*const isPart = g\.includes\('PART'\);\s*return \(\s*\(parseFloat\(item\.rate\) \|\| 0\) > 0 \|\|\s*isAssembly \|\|\s*isPart\s*\);\s*\}\);/g;

content = content.replace(sumBlockRegex, `const billableItems = items.filter(item => {
      const g = (item.item_group || '').toUpperCase();
      return (
        (parseFloat(item.rate) || 0) > 0 ||
        g.includes('ASSEMBLY') ||
        g.includes('PART')
      );
    });`);

// 3. span badge
const spanRegex = /<span className="px-1 py-0\.5 rounded-\[3px\] text-\[8px\] border bg-emerald-50 text-emerald-600 border-emerald-100\/50">\s*\{\(sa\.item_group \|\| 'PART'\)\.toUpperCase\(\)\}\s*<\/span>/g;
const newSpan = `<span className={\`px-1 py-0.5 rounded-[3px] text-[8px] border \${
                                        (sa.item_group || '').toUpperCase().includes('ASSEMBLY')
                                          ? 'bg-blue-50 text-blue-600 border-blue-100/50'
                                          : 'bg-emerald-50 text-emerald-600 border-emerald-100/50'
                                      }\`}>
                                        {(sa.item_group || 'PART').toUpperCase()}
                                      </span>`;

content = content.replace(spanRegex, newSpan);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixes applied.');
