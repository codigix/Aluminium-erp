const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace locked mode DOM
content = content.replace(
  /<span className="text-sm\s+text-slate-900\s*">\{item\.description \|\| 'No Description'\}<\/span>\s*<div className="flex items-center gap-2 mt-0\.5">\s*<span className="text-xs\s+text-slate-500">\{item\.drawing_no \|\| 'Manual Item'\}<\/span>\s*\{\(\(\) => \{\s*const g = \(item\.item_group \|\| ''\)\.toUpperCase\(\);\s*const isPart = g\.includes\('PART'\);\s*const isAssembly = !isPart;\s*return \(\s*<span className=\{`px-1\.5 py-0\.5 rounded text-xs border \$\{\s*isPart\s*\?\s*'bg-emerald-100 text-emerald-700 border-emerald-200'\s*:\s*'bg-blue-100 text-blue-700 border-blue-200'\s*\}\`\}>\s*\{isPart \? 'PART' : 'ASSEMBLY'\}\s*<\/span>\s*\);\s*\}\)\(\)\}\s*<\/div>/g,
  `<div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm text-slate-900">{item.description || 'No Description'}</span>
                                        {(() => {
                                          const g = (item.item_group || '').toUpperCase();
                                          const isPart = g.includes('PART');
                                          return (
                                            <span className={\`px-1.5 py-0.5 rounded text-xs border \${
                                              isPart
                                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                  : 'bg-blue-100 text-blue-700 border-blue-200'
                                            }\`}>
                                              {isPart ? 'PART' : 'ASSEMBLY'}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 font-mono">{item.drawing_no || 'Manual Item'}</span>
                                      </div>`
);

// Replace editable mode DOM (manual/revise)
content = content.replace(
  /<textarea([\s\S]*?)<\/textarea>\s*<div className="flex items-center gap-2 mt-0\.5">\s*<input([\s\S]*?)\/>\s*\{\(\(\) => \{\s*const g = \(item\.item_group \|\| ''\)\.toUpperCase\(\);\s*const isPart = g\.includes\('PART'\);\s*const isAssembly = !isPart;\s*return \(\s*<span className=\{`px-1\.5 py-0\.5 rounded text-xs border \$\{\s*isPart\s*\?\s*'bg-emerald-100 text-emerald-700 border-emerald-200'\s*:\s*'bg-blue-100 text-blue-700 border-blue-200'\s*\}\`\}>\s*\{isPart \? 'PART' : 'ASSEMBLY'\}\s*<\/span>\s*\);\s*\}\)\(\)\}\s*<\/div>/g,
  `<div className="flex items-start gap-2 mb-0.5">
                                        <textarea$1</textarea>
                                        {(() => {
                                          const g = (item.item_group || '').toUpperCase();
                                          const isPart = g.includes('PART');
                                          return (
                                            <span className={\`px-1.5 py-0.5 rounded text-xs border mt-0.5 \${
                                              isPart
                                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                  : 'bg-blue-100 text-blue-700 border-blue-200'
                                            }\`}>
                                              {isPart ? 'PART' : 'ASSEMBLY'}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <input$2/>
                                      </div>`
);

// Replace editable mode DOM (searchable select)
content = content.replace(
  /<SearchableSelect([\s\S]*?)(\/>|<\/SearchableSelect>)\s*\{\(\(\) => \{\s*const g = \(item\.item_group \|\| ''\)\.toUpperCase\(\);\s*const isPart = g\.includes\('PART'\);\s*const isAssembly = !isPart;\s*return \(\s*<span className=\{`px-1\.5 py-0\.5 rounded text-xs border \$\{\s*isPart\s*\?\s*'bg-emerald-100 text-emerald-700 border-emerald-200'\s*:\s*'bg-blue-100 text-blue-700 border-blue-200'\s*\}\`\}>\s*\{isPart \? 'PART' : 'ASSEMBLY'\}\s*<\/span>\s*\);\s*\}\)\(\)\}/g,
  `<div className="flex items-center gap-2 flex-1">
                                        <SearchableSelect$1$2
                                        {(() => {
                                          const g = (item.item_group || '').toUpperCase();
                                          const isPart = g.includes('PART');
                                          return (
                                            <span className={\`px-1.5 py-0.5 rounded text-xs border \${
                                              isPart
                                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                  : 'bg-blue-100 text-blue-700 border-blue-200'
                                            }\`}>
                                              {isPart ? 'PART' : 'ASSEMBLY'}
                                            </span>
                                          );
                                        })()}
                                      </div>`
);

fs.writeFileSync(file, content, 'utf8');
console.log('UI Fixes done.');
