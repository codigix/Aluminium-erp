const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix 1: Stop sub_assemblies overwrite in onChange
content = content.replace(
  /sub_assemblies: drw\?\.sub_assemblies \|\| \[\]/g,
  "sub_assemblies: (drw?.sub_assemblies && drw.sub_assemblies.length > 0) ? drw.sub_assemblies : (it.sub_assemblies || [])"
);

// Fix 2: Remove the "if (isFG) return null;" that hides the ASSEMBLY badge
content = content.replace(
  /const isFG = g\.includes\('FG'\) \|\| g\.includes\('FINISHED'\);\s*if \(isFG\) return null;/g,
  "const isAssembly = !isSA;"
);
// Replace `isSA` and `isFG` logic in badges
content = content.replace(
  /const isSA = \(g\.includes\('SA'\) \|\| g\.includes\('SUB'\) \|\| g\.includes\('ASSEMBLY'\)\) && !g\.includes\('FG'\);/g,
  "const isPart = g.includes('PART');\n                                            const isSA = isPart;"
);
content = content.replace(
  /const isSA = g\.includes\('SA'\) \|\| g\.includes\('SUB'\) \|\| g\.includes\('ASSEMBLY'\);/g,
  "const isPart = g.includes('PART');\n                                            const isSA = isPart;"
);
content = content.replace(/\{isSA \? 'ASSY' : 'PART'\}/g, "{isSA ? 'PART' : 'ASSEMBLY'}");
content = content.replace(
  /'bg-blue-100 text-blue-700 border-blue-200'\s*:\s*'bg-emerald-100 text-emerald-700 border-emerald-200'/g,
  "'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200'"
);

// Fix 3: Move the badge next to description in the view mode (locked/received)
// The view mode looks like:
// <div className="flex flex-col">
//   <span className="text-sm  text-slate-900 ">{item.description || 'No Description'}</span>
//   <div className="flex items-center gap-2 mt-0.5">
//     <span className="text-xs   text-slate-500">{item.drawing_no || 'Manual Item'}</span>
//     {(() => { BADGE })()}
//   </div>
// </div>
content = content.replace(
  /<div className="flex flex-col">\s*<span className="text-sm\s+text-slate-900\s*">\{item\.description \|\| 'No Description'\}<\/span>\s*<div className="flex items-center gap-2 mt-0\.5">\s*<span className="text-xs\s+text-slate-500">\{item\.drawing_no \|\| 'Manual Item'\}<\/span>\s*(\{\(\(\) => \{[\s\S]*?\}\)\(\)\})\s*<\/div>\s*<\/div>/g,
  `<div className="flex flex-col">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm text-slate-900">{item.description || 'No Description'}</span>
                                        $1
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 font-mono">{item.drawing_no || 'Manual Item'}</span>
                                      </div>
                                    </div>`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixes applied successfully!');
