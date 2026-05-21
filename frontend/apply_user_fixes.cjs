const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/QuotationFormPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. JSX deduplication
const jsxRegex = /\/\/\s*Sub-Assembly Rows\s*if\s*\(\s*item\.sub_assemblies\s*&&\s*item\.sub_assemblies\.length\s*>\s*0\s*\)\s*\{\s*item\.sub_assemblies\.forEach\(\(sa,\s*saIdx\)\s*=>\s*\{/g;
const jsxReplacement = `// Sub-Assembly Rows
                      if (item.sub_assemblies && item.sub_assemblies.length > 0) {
                        const uniqueSubAssemblies = item.sub_assemblies.filter(
                          (sa, index, self) => index === self.findIndex(
                            x => x.component_code === sa.component_code && x.description === sa.description
                          )
                        );
                        uniqueSubAssemblies.forEach((sa, saIdx) => {`;
content = content.replace(jsxRegex, jsxReplacement);


// 2. Remove saSum block 1 & 2
// // Recalculate based on sub-assemblies if they exist
// if (item.sub_assemblies && item.sub_assemblies.length > 0) {
//   const saSum = item.sub_assemblies.reduce...
const saSumRegex = /\/\/\s*Recalculate based on sub-assemblies if they exist[\s\S]*?if\s*\(\s*(?:item|matchedDrawing)\.sub_assemblies\s*&&\s*(?:item|matchedDrawing)\.sub_assemblies\.length\s*>\s*0\s*\)\s*\{[\s\S]*?const\s*saSum\s*=[\s\S]*?if\s*\(\s*saSum\s*>\s*.*?\}\s*\}/g;
content = content.replace(saSumRegex, '');

// another variant of saSum without the comment
const saSumRegex2 = /if\s*\(\s*(?:item|matchedDrawing)\.sub_assemblies\s*&&\s*(?:item|matchedDrawing)\.sub_assemblies\.length\s*>\s*0\s*\)\s*\{\s*const\s*saSum\s*=[\s\S]*?if\s*\(\s*saSum\s*>\s*.*?\}\s*\}/g;
content = content.replace(saSumRegex2, '');


// 3. Remove calculatedTotal block
const calcTotalRegex = /const\s*calculatedTotal\s*=\s*saSum\s*\+\s*materialSum\s*\+\s*operationSum;[\s\S]*?bomCost\s*=\s*calculatedTotal;\s*\}\s*else\s*if\s*\(calculatedTotal\s*>\s*.*?\}\s*\}/g;
content = content.replace(calcTotalRegex, '');

const calcTotalRegex2 = /const\s*calculatedTotal\s*=\s*saSum\s*\+\s*materialSum\s*\+\s*operationSum;[\s\S]*?bomCost\s*=\s*calculatedTotal;\s*\}/g;
content = content.replace(calcTotalRegex2, '');

fs.writeFileSync(file, content, 'utf8');
console.log('Processed fixes');
