const fs = require('fs');
const file = 'e:/codigix-project/Aluminium-erp/frontend/src/pages/ClientQuotations.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix isPart definitions that still have SA/SUB/ASSEMBLY
content = content.replace(/const isPart = \(g\.includes\('SA'\) \|\| g\.includes\('SUB'\) \|\| g\.includes\('ASSEMBLY'\) \|\| t\.includes\('SA'\) \|\| t\.includes\('SUB'\) \|\| t\.includes\('ASSEMBLY'\)\);/g, 
  "const isPart = g.includes('PART') || (typeof t !== 'undefined' && t.includes('PART'));");

content = content.replace(/const isPart = \(g\.includes\('SA'\) \|\| g\.includes\('SUB'\) \|\| g\.includes\('ASSEMBLY'\)\) && !g\.includes\('FG'\);/g, 
  "const isPart = g.includes('PART');");
  
content = content.replace(/const isPart = g\.includes\('SA'\) \|\| g\.includes\('SUB'\) \|\| g\.includes\('ASSEMBLY'\);/g, 
  "const isPart = g.includes('PART');");

content = content.replace(/const isPartA = \(gA\.includes\('SA'\) \|\| gA\.includes\('SUB'\) \|\| gA\.includes\('ASSEMBLY'\)\) && !gA\.includes\('FG'\);/g,
  "const isPartA = gA.includes('PART');");

content = content.replace(/const isPartB = \(gB\.includes\('SA'\) \|\| gB\.includes\('SUB'\) \|\| gB\.includes\('ASSEMBLY'\)\) && !gB\.includes\('FG'\);/g,
  "const isPartB = gB.includes('PART');");

content = content.replace(/const isAssemblyA = \(gA\.includes\('FG'\) \|\| gA\.includes\('FINISHED'\)\) && !isPartA;/g,
  "const isAssemblyA = !isPartA;");

content = content.replace(/const isAssemblyB = \(gB\.includes\('FG'\) \|\| gB\.includes\('FINISHED'\)\) && !isPartB;/g,
  "const isAssemblyB = !isPartB;");

content = content.replace(/return g\.includes\('SA'\) \|\| g\.includes\('SUB'\) \|\| g\.includes\('ASSEMBLY'\);/g,
  "return g.includes('PART');");

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed missed lines.');
