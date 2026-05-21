const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// The problematic block is around line 1230 in the editable mode.
// It looks like:
//                                       </div>
//                                       </div>
//                                     </div>
//                                   ) : (
content = content.replace(/<\/div>\s*<\/div>\s*<\/div>\s*\)\s*:\s*\(/g, "</div>\n                                    </div>\n                                  ) : (");

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed syntax error!');
