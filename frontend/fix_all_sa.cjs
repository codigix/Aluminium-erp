const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix 1: loadVersionData return block
const regexLoad = /sub_assemblies:\s*savedSubAssemblies(?!\.map)/g;
content = content.replace(regexLoad, `sub_assemblies: savedSubAssemblies.map(sa => ({
              ...sa,
              bom_cost: parseFloat(sa.bom_cost || sa.rate || 0),
              rate: parseFloat(sa.rate || sa.bom_cost || 0)
            }))`);

// Fix 2: JSX onChange block (approx line 1289)
// It looks like:
// sub_assemblies: g.includes('ASSEMBLY')
// ? ((drw?.sub_assemblies && drw.sub_assemblies.length > 0)
//     ? drw.sub_assemblies.filter(...)
//     : (it.sub_assemblies || []).filter(...))
// : []
const regexJSX = /(sub_assemblies:\s*g\.includes\('ASSEMBLY'\)[\s\S]*?\?\s*\(\(drw\?\.sub_assemblies && drw\.sub_assemblies\.length > 0\)[\s\S]*?\?\s*drw\.sub_assemblies\.filter\(sa => \(sa\.item_group \|\| ''\)\.toUpperCase\(\)\.includes\('PART'\)\)[\s\S]*?:\s*\(it\.sub_assemblies \|\| \[\]\)\.filter\(sa => \(sa\.item_group \|\| ''\)\.toUpperCase\(\)\.includes\('PART'\)\)\))(\s*:\s*\[\])/g;

content = content.replace(regexJSX, `$1.map(sa => ({
                                                      ...sa,
                                                      bom_cost: parseFloat(sa.bom_cost || sa.rate || 0),
                                                      rate: parseFloat(sa.rate || sa.bom_cost || 0)
                                                    }))$2`);


// Fix 3: Initial map in useEffect (approx line 153)
// return (item.sub_assemblies || []).filter(sa =>
//   (sa.item_group || '').toUpperCase().includes('PART')
// );
const regexInitial = /(return\s*\(item\.sub_assemblies \|\| \[\]\)\.filter\(sa =>\s*\(sa\.item_group \|\| ''\)\.toUpperCase\(\)\.includes\('PART'\)\s*\))(;)/g;

content = content.replace(regexInitial, `$1.map(sa => ({
              ...sa,
              bom_cost: parseFloat(sa.bom_cost || sa.rate || 0),
              rate: parseFloat(sa.rate || sa.bom_cost || 0)
            }))$2`);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully injected child BOM mappers to completely isolate costs.');
