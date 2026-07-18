const fs = require('fs');
const content = fs.readFileSync('e:/codigix-project/Aluminium-erp/backend/prisma/schema.prisma', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('production_plan_materials') || line.includes('ProductionPlanMaterials')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
